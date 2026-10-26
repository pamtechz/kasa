import 'dart:io';
import 'dart:convert';

const androidPackage='com.pamtech.kasa';

/// Configure generated Flutter Android runner for KASA's stable Play Store ID.
/// Idempotent; this runs *after* flutter create and before APK builds.
void main() {
  final file=File('android/app/src/main/AndroidManifest.xml');
  if(!file.existsSync()){
    stderr.writeln('Generate Android files using flutter create --platforms=android first.');
    exitCode=2;
    return;
  }
  var xml=file.readAsStringSync();
  final manifest=RegExp(r'<manifest\b[^>]*>',dotAll:true).firstMatch(xml);
  if(manifest==null){
    stderr.writeln('Missing Android manifest root.');
    exitCode=2;
    return;
  }
  const permissions=[
    'android.permission.INTERNET',
    'android.permission.POST_NOTIFICATIONS',
  ];
  final inserts=permissions
    .where((permission)=>!xml.contains('android:name="$permission"'))
    .map((permission)=>'\n    <uses-permission android:name="$permission" />')
    .join();
  if(inserts.isNotEmpty){
    xml=xml.replaceRange(manifest.end,manifest.end,inserts);
  }
  xml=xml.replaceAll('android:label="kasa_mobile"',
                     'android:label="KASA School and Marathon"');
  file.writeAsStringSync(xml);

  // Flutter derives the application ID from --org and --project-name.
  // Its pubspec name stays kasa_mobile, but Android's public package is kasa.
  final gradleKts=File('android/app/build.gradle.kts');
  final gradleGroovy=File('android/app/build.gradle');
  final gradle=gradleKts.existsSync()?gradleKts:gradleGroovy;
  if(!gradle.existsSync()){
    stderr.writeln('Missing Android app Gradle file.');
    exitCode=2;
    return;
  }
  var build=gradle.readAsStringSync();
  final namespace=RegExp(r'''namespace\s*=\s*["'][^"']+["']''');
  final appId=RegExp(r'''applicationId\s*=\s*["'][^"']+["']''');
  if(!namespace.hasMatch(build)||!appId.hasMatch(build)){
    stderr.writeln('Could not identify the generated applicationId and namespace.');
    exitCode=2;
    return;
  }
  build=build.replaceFirst(namespace,'namespace = "$androidPackage"')
             .replaceFirst(appId,'applicationId = "$androidPackage"');
  gradle.writeAsStringSync(build);

  // The manifest contains .MainActivity: move its Kotlin source into the
  // package corresponding to the application ID as well.
  final root=Directory('android/app/src/main/kotlin');
  if(!root.existsSync()){
    stderr.writeln('Missing generated Kotlin runner.');
    exitCode=2;
    return;
  }
  final activities=root.listSync(recursive:true).whereType<File>()
    .where((f)=>f.path.endsWith('MainActivity.kt')).toList();
  if(activities.length!=1){
    stderr.writeln('Expected exactly one generated Android MainActivity.');
    exitCode=2;
    return;
  }
  final activity=activities.single;
  var kotlin=activity.readAsStringSync();
  kotlin=kotlin.replaceFirst(RegExp(r'^package\s+[\w.]+',multiLine:true),'package $androidPackage');
  final target=File('android/app/src/main/kotlin/com/pamtech/kasa/MainActivity.kt');
  target.parent.createSync(recursive:true);
  target.writeAsStringSync(kotlin);
  if(activity.absolute.path!=target.absolute.path)activity.deleteSync();

  // A debug WebView-only APK may be built without native Firebase credentials.
  // Release builds MUST set KASA_REQUIRE_NATIVE_FIREBASE=1 and provide the
  // registered Android app's google-services.json (never commit that file).
  final firebaseFile=File('android/app/google-services.json');
  final requireFirebase=Platform.environment['KASA_REQUIRE_NATIVE_FIREBASE']=='1';
  if(!firebaseFile.existsSync()){
    if(requireFirebase){
      stderr.writeln('Release blocked: register $androidPackage in the School Firebase project and supply android/app/google-services.json.');
      exitCode=2;
      return;
    }
    stdout.writeln('Native FCM is NOT configured (no google-services.json). Web-backed debug build only.');
  }else{
    Map<String,dynamic> config;
    try{
      config=jsonDecode(firebaseFile.readAsStringSync()) as Map<String,dynamic>;
    }catch(_){
      stderr.writeln('Invalid google-services.json.');exitCode=2;return;
    }
    final projectInfo=config['project_info'];
    final clients=config['client'];
    if(projectInfo is! Map || clients is! List){
      stderr.writeln('Invalid Android Firebase configuration structure.');
      exitCode=2;return;
    }
    final actualProject=projectInfo['project_id']?.toString()??'';
    final expectedProject=Platform.environment['KASA_FIREBASE_PROJECT_ID'];
    if(expectedProject!=null && expectedProject.isNotEmpty && actualProject!=expectedProject){
      stderr.writeln('Android Firebase project does not match KASA School.');
      exitCode=2;return;
    }
    final matched=clients.any((item){
      if(item is! Map)return false;
      final clientInfo=item['client_info'];
      if(clientInfo is! Map)return false;
      final info=clientInfo['android_client_info'];
      return info is Map&&info['package_name']==androidPackage;
    });
    if(!matched){
      stderr.writeln('Firebase Android registration mismatch: expected $androidPackage.');
      exitCode=2;return;
    }
    final settings=File('android/settings.gradle.kts');
    if(!settings.existsSync()){
      stderr.writeln('Android Firebase configuration currently requires Kotlin DSL runner.');
      exitCode=2;return;
    }
    var settingsText=settings.readAsStringSync();
    const pluginDecl='id("com.google.gms.google-services") version "4.5.0" apply false';
    if(!settingsText.contains('id("com.google.gms.google-services")')){
      if(!settingsText.contains('id("com.android.application")')){
        stderr.writeln('Unable to register Google Services Gradle plugin.');exitCode=2;return;
      }
      settingsText=settingsText.replaceFirst('id("com.android.application")',
          '$pluginDecl\\n    id("com.android.application")');
      settings.writeAsStringSync(settingsText);
    }
    if(!build.contains('id("com.google.gms.google-services")')){
      if(!build.contains('id("dev.flutter.flutter-gradle-plugin")')){
        stderr.writeln('Unable to apply Google Services Gradle plugin.');exitCode=2;return;
      }
      build=build.replaceFirst('id("dev.flutter.flutter-gradle-plugin")',
          'id("dev.flutter.flutter-gradle-plugin")\\n    id("com.google.gms.google-services")');
      gradle.writeAsStringSync(build);
    }
    stdout.writeln('Native Firebase enabled for $androidPackage (project: $actualProject).');
  }
  stdout.writeln('Android package $androidPackage, Internet and notification permissions configured.');
}
