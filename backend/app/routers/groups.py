import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.group import Group, GroupMember
from app.schemas.group import GroupCreate, GroupOut, GroupWithMembers, MemberOut

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
async def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = Group(id=str(uuid.uuid4()), name=body.name, owner_id=current_user.id)
    db.add(group)
    member = GroupMember(id=str(uuid.uuid4()), group_id=group.id, user_id=current_user.id)
    db.add(member)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/me", response_model=list[GroupWithMembers])
async def get_my_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(GroupMember).where(GroupMember.user_id == current_user.id))
    memberships = result.scalars().all()
    groups = []
    for m in memberships:
        g_res = await db.execute(select(Group).where(Group.id == m.group_id))
        group = g_res.scalar_one_or_none()
        if not group:
            continue
        mem_res = await db.execute(
            select(GroupMember, User)
            .join(User, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == group.id)
        )
        rows = mem_res.all()
        members = [
            MemberOut(
                user_id=u.id,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                joined_at=gm.joined_at,
            )
            for gm, u in rows
        ]
        groups.append(GroupWithMembers(**GroupOut.model_validate(group).model_dump(), members=members))
    return groups


@router.post("/join/{invite_code}", response_model=GroupOut)
async def join_group(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).where(Group.invite_code == invite_code))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite code not found")

    existing = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id)
    )
    if existing.scalar_one_or_none():
        return group

    member = GroupMember(id=str(uuid.uuid4()), group_id=group.id, user_id=current_user.id)
    db.add(member)
    await db.commit()
    return group


@router.delete("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
    )
    await db.commit()
