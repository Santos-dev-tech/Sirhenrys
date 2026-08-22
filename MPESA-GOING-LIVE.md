# Taking M-Pesa live

The site already builds the **exact request body** Safaricom's Daraja STK Push endpoint
expects, and already handles the result codes it returns. What it does not do is send it,
because that requires a server holding secrets that must never sit in a browser.

This is the gap between the demo and production, written down honestly.

---

## What is already correct

`SH.mpesaStkPush()` in `assets/js/data.js` returns this shape:

```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64(shortcode + passkey + timestamp)>",
  "Timestamp": "20260822164551",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 39950,
  "PartyA": "254722123456",
  "PartyB": "174379",
  "PhoneNumber": "254722123456",
  "CallBackURL": "https://api.sirhenrys.co.ke/mpesa/callback",
  "AccountReference": "SH-482913",
  "TransactionDesc": "Sir Henry's online order"
}
```

Phone numbers are normalised to Safaricom's MSISDN format (`0722…` → `254722…`).

`SH.mpesaResolve()` returns Daraja's real result codes:

| Code | Meaning | Handled |
|---|---|---|
| 0 | Success | receipt number issued, order created |
| 1032 | Cancelled by user | payment abandoned, cart kept |
| 1037 | Timeout, user unreachable | offer resend |
| 2001 | Wrong PIN | offer retry |
| 1 | Insufficient balance | shown to the customer |

---

## What has to be built

**1. A server.** The Consumer Key, Consumer Secret and Passkey cannot live in client-side
JavaScript — anyone viewing source would have them. You need a small backend (Node, Python,
anything) with three endpoints:

- `POST /mpesa/stkpush` — takes the amount and phone, gets an OAuth token, calls Daraja,
  returns the `CheckoutRequestID`
- `POST /mpesa/callback` — the public URL Safaricom calls when the customer acts. **Must be
  HTTPS and publicly reachable.** This is what actually confirms payment.
- `GET /mpesa/status/:id` — the browser polls this while the customer is entering their PIN

**2. Safaricom credentials.** From the Daraja portal: create an app, get the Consumer Key
and Secret, and have the Paybill/Till shortcode and Passkey issued for production. Sandbox
uses shortcode `174379` and a public test passkey; production values are different.

**3. Never trust the browser.** Mark an order paid **only** when the callback arrives with
`ResultCode: 0`. A client-side "success" can be faked by anyone with dev tools.

**4. Idempotency.** Safaricom can call the callback more than once. Store
`CheckoutRequestID` and ignore duplicates, or you will double-fulfil orders.

---

## Where to change it

`assets/js/data.js` → `settings.mpesa`:

```js
mpesa: {
  shortcode: '174379',
  callback:  'https://api.sirhenrys.co.ke/mpesa/callback',
  live: false          // ← flip to true once the server exists
}
```

When `live` is true, `mpesaStkPush` should `POST` to your own endpoint instead of resolving
locally. That is the only call site that changes — the checkout UI, the till and the result
handling all stay as they are.

---

## Why this is worth doing

Kenya is not on Shopify Payments — no African country is. That means Sir Henry's pays
Shopify an **extra 0.6%–2% on every single order** purely for using a third-party gateway.
On KSh 1,000,000 of monthly online sales that is **KSh 6,000–20,000 a month** on top of
whatever the gateway itself charges.

Taking payments directly removes that penalty entirely. The Safaricom transaction cost
remains — that one is unavoidable and is theirs either way.
