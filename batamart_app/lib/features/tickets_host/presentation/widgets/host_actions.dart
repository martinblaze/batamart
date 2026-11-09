import 'package:flutter/material.dart';

import '../../../../core/api/api_exception.dart';

/// Runs a mutation, shows the server's message in a snackbar when it fails
/// and an optional [success] message when it works. Returns true on success.
Future<bool> runHostAction(
  BuildContext context,
  Future<void> Function() action, {
  String? success,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    await action();
    if (success != null) messenger.showSnackBar(SnackBar(content: Text(success)));
    return true;
  } on ApiException catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('$e')));
  }
  return false;
}
