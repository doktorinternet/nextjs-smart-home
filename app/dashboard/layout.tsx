import styles from './layout.module.css'

export default function DashboardLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode
}) {
  return <div className={styles.dashboardLayout}>{children}</div>
}
