import 'dart:async';
import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'navigation_policy.dart';

const _portalUrl = String.fromEnvironment(
  'KASA_PORTAL_URL',
  defaultValue: 'https://kasaschool.vercel.app',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  var firebaseReady = false;
  try {
    // flutterfire configure supplies platform-specific Firebase credentials.
    await Firebase.initializeApp();
    firebaseReady = true;
  } catch (_) {
    // Allow School and Marathon browser operations without native push during setup.
  }
  runApp(KasaApp(firebaseReady: firebaseReady));
}

class KasaApp extends StatelessWidget {
  const KasaApp({super.key, required this.firebaseReady});
  final bool firebaseReady;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'KASA School & Life Marathon',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF174B36)),
        ),
        home: KasaWorkspace(firebaseReady: firebaseReady),
      );
}

class KasaWorkspace extends StatefulWidget {
  const KasaWorkspace({super.key, required this.firebaseReady});
  final bool firebaseReady;

  @override
  State<KasaWorkspace> createState() => _KasaWorkspaceState();
}

class _KasaWorkspaceState extends State<KasaWorkspace> {
  final Uri _portal = Uri.parse(_portalUrl);
  late final WebViewController _web;
  StreamSubscription<String>? _tokens;
  StreamSubscription<RemoteMessage>? _foreground;
  StreamSubscription<RemoteMessage>? _opened;
  String? _pushToken;
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF6F8F6))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() {_loading = true; _loadError = null;});
        },
        onPageFinished: (url) {
          if (mounted) setState(() => _loading = false);
          final page = Uri.tryParse(url);
          if (page != null && isKasaPage(page, _portal)) _publishPushToken();
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame == true && mounted) {
            setState(() {
              _loading = false;
              _loadError = 'Unable to open KASA. Check your connection and retry.';
            });
          }
        },
        onNavigationRequest: (request) {
          final destination = Uri.tryParse(request.url);
          if (destination == null) return NavigationDecision.prevent;
          if (isKasaPage(destination, _portal)) return NavigationDecision.navigate;
          if (['https', 'http', 'mailto', 'tel'].contains(destination.scheme)) {
            unawaited(launchUrl(destination, mode: LaunchMode.externalApplication));
          }
          return NavigationDecision.prevent;
        },
      ))
      ..loadRequest(_portal);
    if (_web.platform is AndroidWebViewController) {
      unawaited((_web.platform as AndroidWebViewController).setOnShowFileSelector(
        (params) async {
          // Android needs an explicit chooser; the server remains responsible
          // for validating the selected file type, ownership and size.
          if (params.mode == FileSelectorMode.save) return <String>[];
          try {
            List<PlatformFile> files;
            if (params.mode == FileSelectorMode.openMultiple) {
              files = await FilePicker.pickFiles(type: FileType.any);
            } else {
              final selected = await FilePicker.pickFile(type: FileType.any);
              files = selected == null ? <PlatformFile>[] : <PlatformFile>[selected];
            }
            return files
                .where((file) => file.path != null && file.path!.isNotEmpty)
                .map((file) => Uri.file(file.path!).toString())
                .toList();
          } catch (_) {
            return <String>[];
          }
        },
      ));
    }
    if (widget.firebaseReady) unawaited(_initializePush());
  }

  Future<void> _initializePush() async {
    try {
      final messages = FirebaseMessaging.instance;
      final permission = await messages.requestPermission(
        alert: true, badge: true, sound: true,
      );
      if (permission.authorizationStatus == AuthorizationStatus.denied) return;
      _pushToken = await messages.getToken();
      await _publishPushToken();
      _tokens = messages.onTokenRefresh.listen((token) {
        _pushToken = token;
        unawaited(_publishPushToken());
      });
      _foreground = FirebaseMessaging.onMessage.listen((message) {
        if (!mounted) return;
        final title = message.notification?.title ?? 'KASA update';
        final content = message.notification?.body ?? 'New activity';
        final path = safeInternalPath(message.data['path']);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$title — $content'),
          duration: const Duration(seconds: 8),
          action: path == null ? null : SnackBarAction(
            label: 'VIEW',
            onPressed: () => _openPath(path),
          ),
        ));
      });
      _opened = FirebaseMessaging.onMessageOpenedApp.listen(_openPush);
      final initial = await messages.getInitialMessage();
      if (initial != null) _openPush(initial);
    } catch (_) {
      // Native messaging may be unavailable on an emulator without Play Services.
      // Retain the website and allow normal manual refresh.
    }
  }

  Future<void> _publishPushToken() async {
    final value = _pushToken;
    if (!mounted || value == null || value.isEmpty) return;
    try {
      final current = Uri.tryParse(await _web.currentUrl() ?? '');
      if (current == null || !isKasaPage(current, _portal)) return;
      // The website signs its API request with Firebase Auth; no web ID token
      // or Firestore credential is passed into Flutter.
      final literal = jsonEncode(value);
      await _web.runJavaScript('''
        window.__KASA_FCM_TOKEN = $literal;
        window.dispatchEvent(new CustomEvent('kasa:fcm-token',
          {detail: {token: $literal}}));
      ''');
    } catch (_) {
      // Next page load or token refresh retries delivery to the web bridge.
    }
  }

  void _openPush(RemoteMessage message) {
    final path = safeInternalPath(message.data['path']);
    if (path != null) _openPath(path);
  }

  void _openPath(String path) {
    final destination = _portal.resolve(path);
    if (isKasaPage(destination, _portal)) {
      unawaited(_web.loadRequest(destination));
    }
  }

  @override
  void dispose() {
    _tokens?.cancel();
    _foreground?.cancel();
    _opened?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        onPopInvokedWithResult: (popped, result) async {
          if (!popped && await _web.canGoBack()) await _web.goBack();
        },
        child: Scaffold(
          body: SafeArea(
            child: Stack(children: [
              WebViewWidget(controller: _web),
              if (_loading) const Positioned(
                top: 0, left: 0, right: 0,
                child: LinearProgressIndicator(minHeight: 3),
              ),
              if (_loadError != null)
                Center(child: Card(
                  margin: const EdgeInsets.all(24),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.wifi_off, size: 36),
                        const SizedBox(height: 16),
                        Text(_loadError!, textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: () {
                            setState(() => _loadError = null);
                            _web.reload();
                          },
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )),
            ]),
          ),
        ),
      );
}
