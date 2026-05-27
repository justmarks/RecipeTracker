// SignInView — landing screen for unauthenticated users.

function SignInView({ onSignIn }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-page)", padding: "32px",
    }}>
      <div style={{
        maxWidth: "440px", width: "100%",
        background: "var(--bg-card)", borderRadius: "var(--radius-xl)",
        padding: "48px 40px", boxShadow: "var(--shadow-md)",
        textAlign: "center",
      }}>
        <img src="../../assets/monogram.svg" width="72" height="72"
             style={{ display: "block", margin: "0 auto 20px" }} alt=""/>

        <h1 style={{
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "32px",
          lineHeight: 1.1, letterSpacing: "-0.01em",
          color: "var(--fg-default)", margin: 0,
        }}>
          Marks Family
        </h1>
        <p style={{
          fontFamily: "var(--font-display)", fontStyle: "italic",
          fontWeight: 400, fontSize: "26px", lineHeight: 1.1,
          color: "var(--tomato-500)", margin: "2px 0 20px",
        }}>
          Recipe Book
        </p>

        <p style={{
          fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.6,
          color: "var(--fg-muted)", maxWidth: "320px", margin: "0 auto 28px",
        }}>
          Sign in to keep your recipes in one place. Search by ingredient,
          share with family, install to your phone.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Button variant="primary" size="lg" onClick={onSignIn}
                  style={{ width: "100%", justifyContent: "center" }}>
            Continue with Google
          </Button>
          <Button variant="secondary" size="lg" onClick={onSignIn}
                  style={{ width: "100%", justifyContent: "center" }}>
            Continue with Microsoft
          </Button>
        </div>

        <p style={{
          marginTop: "28px", fontSize: "12px",
          color: "var(--fg-subtle)", fontFamily: "var(--font-sans)",
        }}>
          Your recipes live in your account. Shared recipes are visible only to people you choose.
        </p>
      </div>
    </div>
  );
}

window.SignInView = SignInView;
