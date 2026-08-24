export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Each staff page declares the capability it needs; there is no blanket gate,
  // because the roster, the gradebook, and late days are different powers.
  return <>{children}</>;
}
