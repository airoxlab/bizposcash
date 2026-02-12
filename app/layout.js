import './globals.css'
import Script from 'next/script'
import NotificationSystem from '../components/ui/NotificationSystem'
import GlobalPrintListener from '../components/GlobalPrintListener'
import UpdateNotification from '../components/UpdateNotification'

export const metadata = {
  title: 'BizPOS - Point of Sale System',
  description: 'Modern Point of Sale System for Restaurants and Cafes',
}

// Inline script to set initial theme class on <html> before React hydrates.
// This prevents flashes / ensures Tailwind `dark:` variants match on first paint.
const setInitialThemeScript = `(function(){
  try {
    var theme = (window._themeSettings && window._themeSettings.theme) || localStorage.getItem('theme') || 'light';
    document.documentElement.classList.remove('light','dark');
    document.documentElement.classList.add(theme);
  } catch(e) { /* ignore */ }
})();`

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: setInitialThemeScript }} />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <GlobalPrintListener />
        {children}
        <NotificationSystem />
        <UpdateNotification />
      </body>
    </html>
  )
}