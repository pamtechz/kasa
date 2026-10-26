import 'dart:io';

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

  stdout.writeln('Android package $androidPackage, Internet and notification permissions configured.');
}
