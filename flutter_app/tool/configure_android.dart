import 'dart:io';

/// Configures the generated Android manifest for WebView connectivity and FCM.
/// Idempotent; run after flutter create and before Android builds.
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
  stdout.writeln('Android Internet and notification permissions configured.');
}
