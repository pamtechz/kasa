import 'package:flutter_test/flutter_test.dart';
import 'package:kasa_mobile/navigation_policy.dart';

void main() {
  final portal = Uri.parse('https://kasaschool.vercel.app');
  test('only exact first-party site may access device notification bridge', () {
    expect(isKasaPage(Uri.parse('https://kasaschool.vercel.app/marathon/operations'),portal),true);
    expect(isKasaPage(Uri.parse('http://kasaschool.vercel.app'),portal),false);
    expect(isKasaPage(Uri.parse('https://kasaschool.vercel.app.evil.com'),portal),false);
    expect(isKasaPage(Uri.parse('https://evil.com'),portal),false);
  });
  test('notification deep links cannot escape first-party path', () {
    expect(safeInternalPath('/marathon/operations'),'/marathon/operations');
    expect(safeInternalPath('//evil.com'),isNull);
    expect(safeInternalPath('/../admin'),isNull);
    expect(safeInternalPath('https://evil.com'),isNull);
  });
}
