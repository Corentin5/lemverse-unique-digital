const inputSelector = '.console .js-command-input';
const inputFileSelector = '.console .console-file';

const markInputFileWithContent = value => {
  const label = document.querySelector('label[for="console-file"]');
  if (!label) return;

  label.classList.toggle('has-content', value);
};

const clearInputFields = (focus = true) => {
  Tracker.afterFlush(() => {
    const field = document.querySelector(inputSelector);
    if (field) {
      field.value = '';
      if (focus) field.focus();
    }

    const fileField = document.querySelector(inputFileSelector);
    if (fileField) {
      fileField.value = '';
      markInputFileWithContent(false);
    }
  });
};

const closeAndFocusCanvas = () => {
  Session.set('console', false);
  window.dispatchEvent(new CustomEvent(eventTypes.consoleClosed));

  document.querySelector(inputSelector)?.blur();
  document.querySelector(inputFileSelector).value = '';
  hotkeys.setScope(scopes.player);
  game.scene.keys.WorldScene.enableKeyboard(true, false);
};

openConsole = (autoSelectChannel = false) => {
  if (Session.get('console') || Session.get('editor')) return false;

  if (autoSelectChannel) messagesModule.autoSelectChannel();
  clearInputFields(true);
  Session.set('console', true);

  return true;
};

const onKeyPressed = e => {
  if (e.key === 'Escape') closeAndFocusCanvas();
  else if (e.key === 'Enter' && openConsole(true)) {
    e.preventDefault();
    e.stopPropagation();
  }
};

const onPasteAction = e => {
  const consoleFileInput = document.querySelector('.console-file');
  if (!consoleFileInput) return;

  consoleFileInput.files = e.clipboardData.files;
  markInputFileWithContent(true);
};

const sendMessage = (channel, text) => {
  let messageId;

  try {
    messageId = messagesModule.sendMessage(channel, text);
    clearInputFields(true);
  } catch (e) { lp.notif.error(e); }

  return messageId;
};

const onSubmit = () => {
  const { files } = document.querySelector(inputFileSelector);
  const text = document.querySelector(inputSelector).value;
  if (!text && !files.length) {
    closeAndFocusCanvas();
    return;
  }

  const channel = Session.get('messagesChannel');
  if (!channel) {
    lp.notif.error('You have to be in a zone and/or near someone to send a message');
    return;
  }

  // message without file
  if (!files.length) { sendMessage(channel, text); return; }

  // upload file and send message
  const uploadedFile = Files.insert({
    file: files[0],
    meta: { source: 'user-console', userId: Meteor.userId() },
  }, false);

  uploadedFile.on('end', (error, file) => {
    if (error) { lp.notif.error(`Error during file upload: ${error.reason}`); return; }

    const messageId = sendMessage(channel, text);
    if (messageId) Messages.update(messageId, { $set: { fileId: file._id } });
    else Files.remove(file._id);
  });

  uploadedFile.start();
};

Template.console.onCreated(function () {
  Session.set('console', false);
  document.addEventListener('keydown', onKeyPressed);
  document.addEventListener('paste', onPasteAction);

  this.autorun(() => {
    if (Session.get('modal')) closeAndFocusCanvas();
  });
});

Template.console.onDestroyed(() => {
  Session.set('console', false);
  document.removeEventListener('keydown', onKeyPressed);
  document.removeEventListener('paste', onPasteAction);
});

Template.console.events({
  'focus .js-command-input'() { hotkeys.setScope(scopes.form); game.scene.keys.WorldScene.enableKeyboard(false, false); },
  'blur .js-command-input'() { hotkeys.setScope(scopes.player); game.scene.keys.WorldScene.enableKeyboard(true, false); },
  'change .console-file'(event) { markInputFileWithContent(!!event.currentTarget.files.length); },
  'click .js-button-submit, submit .js-console-form'(event) {
    event.preventDefault();
    event.stopPropagation();
    onSubmit();
  },
});
