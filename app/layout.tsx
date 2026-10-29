import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: "Super Jeremy Bro's",
  description: 'One world. Six chapters. Play through Jeremy’s story in an original 8-bit platform game.',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
