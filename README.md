# plugin-location

**Location** for [FlickerTalk](https://flickertalk.com): send where you are, once, as a message.

One screen, one big button: **📍 Send my location**. The plugin asks the phone for the current
position once, shows how accurate it is (`±20 m`) and puts it in the message box. You are the one
who presses send. If the phone gives no position (location off, or the permission refused), it
says so and offers to try again.

What goes into the message is a plain [RFC 5870](https://www.rfc-editor.org/rfc/rfc5870) geo URI:

```text
geo:40.41680,-3.70380;u=20
```

Latitude and longitude to five decimals (about a metre), and the uncertainty in whole metres,
rounded up so it never claims to be more precise than the phone was. FlickerTalk shows it as a
location card on both sides; the person who receives it does not need this plugin.

## Permissions

| Permission         | Why                                                   |
| ------------------ | ----------------------------------------------------- |
| `location`         | to ask the core for the current position, once        |
| `send: "propose"`  | to put the geo URI in the message box (not to send it) |

Nothing else: no `network`, no `messages`, no storage.

## Privacy

- Only the current position, once, when you press the button. No live sharing, no tracking.
- No network at all: no map tiles, no geocoding, no map servers. The plugin cannot reach the
  internet.
- Nothing is kept: the plugin stores nothing, and forgets the position when it closes.
- The position travels like any other FlickerTalk message, end-to-end encrypted.

## Development

```sh
npm install
npm test
```

`dist/index.js` registers the web component `ft-location` and exports the pure functions
(`geoUri`, `accuracyLabel`) for the tests; `dist/i18n.js` holds the texts in the app's 21 languages,
English as the source (a test checks every language has the same keys). There is nothing to build.
The `.ftplugin` package is signed by the FlickerTalk catalogue, not here. The contract is in
[plugin-sdk](https://github.com/FlickerTalk/plugin-sdk).

## License

MIT.
