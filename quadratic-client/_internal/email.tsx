import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

const API_URL = import.meta.env.VITE_QUADRATIC_API_URL;

const container = document.getElementById('root');
const root = createRoot(container as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function App(props) {
  const [emailIds, setEmailIds] = useState([]);
  const [email, setEmail] = useState({ html: '', subject: '', from: { name: '', email: '' } });

  useEffect(() => {
    fetch(`${API_URL}/v0/internal/emails`)
      .then((res) => res.json())
      .then((emailIds) => {
        setEmailIds(emailIds);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return (
    <div className="container">
      <div>
        <div style={{ position: 'absolute', right: '0' }}>
          <select
            onChange={(e) => {
              const id = e.target.value;
              fetch(`${API_URL}/v0/internal/emails/${id}`)
                .then((res) => res.json())
                .then((email) => {
                  setEmail(email);
                })
                .catch((err) => {
                  console.error(err);
                });
            }}
          >
            <option>Select a template...</option>
            {emailIds.map((emailId) => (
              <option value={emailId}>{emailId}</option>
            ))}
          </select>
        </div>
        <div style={{ fontWeight: '500' }}>{email.subject ? email.subject : '[Subject]'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <div style={{ width: '24px', height: '24px', backgroundColor: '#ddd', borderRadius: '50%' }}></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>
              {email.from ? email.from.name : '[Sender]'}
              <span
                style={{
                  fontSize: '12px',
                  opacity: '.5',
                  fontWeight: '400',
                }}
              >
                {' <'}notify@email.quadratichq.com{'>'}
              </span>
            </span>
            <span style={{ fontSize: '12px', opacity: '.5' }}>to: me@example.com</span>
          </div>
        </div>
      </div>
      <div>
        <iframe title="email-preview" srcDoc={email.html}></iframe>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: /*css*/ `
      *,
      *::before,
      *::after {
        box-sizing: border-box;
      }
      body {
        font-family: sans-serif;
        margin: 0;
        padding: 0;
        max-width: 560px;
        margin: 0 auto;
        background: #f7f7f7;
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        position: relative;
      }
      .container > div:first-child {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: .5rem;
        height: 5rem;
        position: relative;
      }
      .container > div:first-child > * {
        margin: 0;
      }
      .container > div:first-child + div {
        background: #fff;
        min-height: calc(100vh - 7rem);
        display: flex;
      }
      iframe {
        width: 100%;
        border: none;
      }
      `,
        }}
      ></style>
    </div>
  );
}
