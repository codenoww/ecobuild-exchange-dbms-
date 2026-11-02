import "./globals.css";

export const metadata = {
  title: "EcoBuild Exchange",
  description: "Sustainable material advisor + circular furniture marketplace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="brand">EcoBuild Exchange</a>
          <nav>
            <a href="/materials">Materials</a>
            <a href="/marketplace">Marketplace</a>
            <a href="/projects">My Projects</a>
            <a href="/login">Login</a>
            <a href="/register">Register</a>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
