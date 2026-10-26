import 'dart:io';

/// Only for authenticated manual CI release builds with real Firebase setup.
/// Key material stays in runner environment and the untracked keystore file.
void main() {
  final json=File('android/app/google-services.json');
  final keystore=File('android/app/kasa-release.jks');
  if(!json.existsSync()||!keystore.existsSync()){
    stderr.writeln('Release signing requires registered Firebase Android config and an upload keystore.');
    exitCode=2;return;
  }
  for(final key in ['KASA_ANDROID_KEY_ALIAS','KASA_ANDROID_KEY_PASSWORD','KASA_ANDROID_STORE_PASSWORD']){
    if((Platform.environment[key]??'').isEmpty){
      stderr.writeln('Release signing environment missing: $key');
      exitCode=2;return;
    }
  }
  final file=File('android/app/build.gradle.kts');
  if(!file.existsSync()){
    stderr.writeln('Expected Kotlin Gradle runner.');
    exitCode=2;return;
  }
  var build=file.readAsStringSync();
  const debug='signingConfig = signingConfigs.getByName("debug")';
  const release='signingConfig = signingConfigs.getByName("kasaRelease")';
  const marker='    buildTypes {';
  if(!build.contains(marker)){
    stderr.writeln('Cannot find Android build types.');exitCode=2;return;
  }
  if(!build.contains(release)){
    if(!build.contains(debug)){
      stderr.writeln('Refusing release build: unexpected signing configuration.');
      exitCode=2;return;
    }
    build=build.replaceFirst(debug,release);
  }
  if(!build.contains('create("kasaRelease")')){
    build=build.replaceFirst(marker,'''
    signingConfigs {
        create("kasaRelease") {
            keyAlias = System.getenv("KASA_ANDROID_KEY_ALIAS")
            keyPassword = System.getenv("KASA_ANDROID_KEY_PASSWORD")
            storeFile = file("kasa-release.jks")
            storePassword = System.getenv("KASA_ANDROID_STORE_PASSWORD")
        }
    }
$marker''');
  }
  file.writeAsStringSync(build);
  stdout.writeln('Release signing configuration installed (credentials not logged).');
}
