export function Layout(children: string) {
  return /*html*/ `<!DOCTYPE html>
  <html>
  <head>
    <title>Welcome to Quadratic</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Open+Sans&display=swap" rel="stylesheet">
    <style type="text/css">
      /* Set the background color and font styles for the entire email */
      @import url('https://fonts.googleapis.com/css2?family=Open+Sans&display=swap');
      body {
          background-color: #fff;
          font-family: 'Open Sans', sans-serif;
          color: #000;
          font-size: 16px;
          line-height: 22px;
      }
    </style>
  </head>
  <body style="background-color:#ffffff; padding:0 10px;">
    <div class="wrapper" style="max-width:560px; padding: 35px 20px;">
      <!-- Email header -->
      <div class="header" style="padding:35px 0 35px 5px;">
        <a href="https://quadratichq.com?utm_source=sharefile&utm_medium=email" target="_blank">
          <img src="https://media.quadratichq.com/email/quadratic-white-stroke.png" width="165" />
        </a>
      </div>
      <!-- Email body -->
      <div class="body" style="padding:0 15px;">
        <div class="section" style="padding:0 0 25px;">
          ${children}
        </div>
        <!-- Email footer -->
        <div class="footer">
          <div class="subfooter">
            <div style="height:0px; color:#ccc; border-top:2px solid #eee;padding:5px 0 15px;"></div>
            <p style="font-family:'Open Sans', sans-serif; color:#999;
          font-size:12px;">Sent by <a href="https://quadratichq.com?utm_source=sharefile&utm_medium=email"
                    target="_blank" style="color: #999;">Quadratic</a> - 1200 Pearl
                Street, Boulder, CO 80302.<br> You received this email because
                someone shared a spreadsheet with you from Quadratic.
            </p>
          </div>
        </div>
      </div>
  </body>
  </html>
  `;
}

export function Link(children: string, { to }: { to: string }) {
  return /*html*/ `<a
    href="${to}"
    target="_blank"
    style="
      font-family: 'Open Sans', sans-serif;
      font-size: 16px;
      color: inherit;">${children}</a>`;
}

export function Bold(children: string) {
  return /*html*/ `<strong style="font-weight: bold">${children}</strong>`;
}

export function Button(children: string, { to }: { to: string }) {
  return /*html*/ `<a
    href="${to}"
    class="button"
    target="_blank"
    style="
      font-family: 'Open Sans', sans-serif;
      background: #252528;
      border: none;
      color: #fff !important;
      display: inline-block;
      font-size: 16px;
      padding: 12px 22px;
      margin: 0 0 10px;
      text-align: center;
      text-decoration: none;
      vertical-align: middle;
      color-scheme: light;
      border-radius: 3px;">${children}</a>`;
}

export function Paragraph(children: string) {
  return /*html*/ `<p
    style="
      font-family:'Open Sans', sans-serif;
      font-size: 16px;
      line-height: 26px;
      padding:0 0 40px 0;
      background: #fff;">${children}</p>`;
}
