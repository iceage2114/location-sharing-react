package com.example.locationshare

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature


// test 1
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var geolocationCallback: GeolocationPermissions.Callback? = null
    private var geolocationOrigin: String? = null

    companion object {
        private const val APP_URL = "https://location-sharing-react-1.onrender.com/"
        private const val LOCATION_PERMISSION_REQUEST_CODE = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        setupWebView()
        webView.loadUrl(APP_URL)
    }

    private fun setupWebView() {
        // Override user agent to avoid servers blocking WebView-identified requests
        val chromeUserAgent = webView.settings.userAgentString
            .replace(Regex("\\(Linux;.*?\\)"), "(Linux; Android 10; Mobile)")
            .replace(Regex("Version/[\\d.]+\\s"), "")
            .replace(" wv", "")

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            userAgentString = chromeUserAgent
            // Allow map tiles and other mixed content to load
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            // Required for onCreateWindow to fire for OAuth popups
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = true
        }

        // Enable cookies so OAuth session is persisted after login
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        // Suppress the X-Requested-With header so Google doesn't identify this as a WebView.
        // The header normally carries the app package name and is a primary detection signal.
        // Passing an empty allow-list means no origin receives the header.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
            WebSettingsCompat.setRequestedWithHeaderOriginAllowList(webView.settings, emptySet())
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                // Flush cookies so the auth session is persisted to disk after the OAuth redirect.
                CookieManager.getInstance().flush()
                // Inject window.chrome here (onPageFinished) so it runs after the JS environment
                // is fully initialized — onPageStarted is too early and causes a race condition
                // where Google's detection scripts can run before the object is set.
                if (url.contains("accounts.google.com")) {
                    view.evaluateJavascript(
                        "(function(){if(!window.chrome){window.chrome={runtime:{},loadTimes:function(){return{}},csi:function(){return{}}};}})();",
                        null
                    )
                }
            }

            override fun onReceivedError(
                view: WebView,
                errorCode: Int,
                description: String,
                failingUrl: String
            ) {
                @Suppress("DEPRECATION")
                super.onReceivedError(view, errorCode, description, failingUrl)
                Log.e("WebView", "Page error $errorCode: $description — $failingUrl")
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: android.webkit.WebResourceResponse
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                Log.e("WebView", "HTTP ${errorResponse.statusCode} — ${request.url}")
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val url = request.url.toString()
                // Let the WebView handle http/https natively so OAuth redirect chains
                // are followed intact (calling loadUrl() here breaks that chain).
                if (url.startsWith("https://") || url.startsWith("http://")) {
                    return false
                }
                // For non-http schemes (intent://, market://, etc.) open externally.
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    true
                } catch (e: Exception) {
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                geolocationOrigin = origin
                geolocationCallback = callback
                requestLocationPermission()
            }

            // Forward JS console output to Logcat so errors during the auth callback
            // are visible without needing chrome://inspect.
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                val level = message.messageLevel()
                val text = "[JS ${message.sourceId()}:${message.lineNumber()}] ${message.message()}"
                when (level) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e("WebViewConsole", text)
                    ConsoleMessage.MessageLevel.WARNING -> Log.w("WebViewConsole", text)
                    else -> Log.d("WebViewConsole", text)
                }
                return true
            }

            // Handle any popup windows Google opens during the OAuth flow
            // (e.g., account-picker or 2-step prompts).
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message
            ): Boolean {
                val popupWebView = WebView(this@MainActivity).apply {
                    // Mirror all anti-detection settings from the main WebView so Google
                    // doesn't see a naked WebView user-agent inside the popup.
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.userAgentString = webView.settings.userAgentString
                    if (WebViewFeature.isFeatureSupported(WebViewFeature.REQUESTED_WITH_HEADER_ALLOW_LIST)) {
                        WebSettingsCompat.setRequestedWithHeaderOriginAllowList(settings, emptySet())
                    }
                }
                // Accept cookies in the popup so the Google auth session is maintained.
                CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true)

                // Display the popup as a full-screen overlay so the user can interact with it.
                val rootLayout = findViewById<ViewGroup>(R.id.rootLayout)
                rootLayout.addView(
                    popupWebView,
                    ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )
                popupWebView.tag = "googleAuthPopup"

                popupWebView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String) {
                        super.onPageFinished(view, url)
                        CookieManager.getInstance().flush()
                        // Inject window.chrome so Google's scripts don't detect a bare WebView.
                        if (url.contains("accounts.google.com")) {
                            view.evaluateJavascript(
                                "(function(){if(!window.chrome){window.chrome={runtime:{},loadTimes:function(){return{}},csi:function(){return{}}};}})();",
                                null
                            )
                        }
                    }

                    override fun shouldOverrideUrlLoading(
                        view: WebView,
                        request: WebResourceRequest
                    ): Boolean {
                        val url = request.url.toString()
                        if (url.startsWith("https://") || url.startsWith("http://")) {
                            return false
                        }
                        return try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            true
                        } catch (e: Exception) {
                            true
                        }
                    }
                }

                popupWebView.webChromeClient = object : WebChromeClient() {
                    // Called when Google's JS calls window.close() after auth completes.
                    override fun onCloseWindow(window: WebView) {
                        rootLayout.removeView(window)
                        window.destroy()
                        CookieManager.getInstance().flush()
                    }
                }

                val transport = resultMsg.obj as WebView.WebViewTransport
                transport.webView = popupWebView
                resultMsg.sendToTarget()
                return true
            }
        }
    }

    private fun requestLocationPermission() {
        val fineLocation = Manifest.permission.ACCESS_FINE_LOCATION
        val coarseLocation = Manifest.permission.ACCESS_COARSE_LOCATION

        if (ContextCompat.checkSelfPermission(this, fineLocation) == PackageManager.PERMISSION_GRANTED) {
            geolocationCallback?.invoke(geolocationOrigin, true, false)
        } else {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(fineLocation, coarseLocation),
                LOCATION_PERMISSION_REQUEST_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == LOCATION_PERMISSION_REQUEST_CODE) {
            val granted = grantResults.isNotEmpty() &&
                    grantResults[0] == PackageManager.PERMISSION_GRANTED
            geolocationCallback?.invoke(geolocationOrigin, granted, false)
        }
    }

    override fun onBackPressed() {
        val rootLayout = findViewById<ViewGroup>(R.id.rootLayout)
        val popup = rootLayout.findViewWithTag<WebView>("googleAuthPopup")
        if (popup != null) {
            rootLayout.removeView(popup)
            popup.destroy()
            return
        }
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
