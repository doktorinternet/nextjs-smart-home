'use client'

import CustomTimeTable from '@/app/components/TimeTable/CustomTimeTable'

type ModuleCardProps = {
  eyebrow: string
  title: string
  description: string
  icon: string
}

function ModuleCard({ eyebrow, title, description, icon }: ModuleCardProps) {
  return (
    <section className="dashboard-module" aria-label={title}>
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true">{icon}</span>
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="dashboard-module-empty">
        <span className="dashboard-empty-mark" aria-hidden="true">＋</span>
        <p>{description}</p>
      </div>
    </section>
  )
}

export default function Page() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">H</span>
            <div>
              <p className="dashboard-eyebrow">Home overview</p>
              <h1>Good to be home<span>.</span></h1>
            </div>
          </div>
          <div className="dashboard-header-note">
            <span>Your home, at a glance</span>
          </div>
        </header>

        <div className="dashboard-grid">
          <section className="dashboard-module dashboard-transit" aria-labelledby="transit-heading">
            <div className="dashboard-module-heading">
              <span className="dashboard-module-icon" aria-hidden="true">↗</span>
              <div>
                <p className="dashboard-eyebrow">Getting around</p>
                <h2 id="transit-heading">Tram departures</h2>
              </div>
              <span className="dashboard-source">Västtrafik</span>
            </div>
            <div className="dashboard-transit-content">
              <CustomTimeTable />
            </div>
          </section>

          <div className="dashboard-side-stack">
            <ModuleCard
              eyebrow="At home"
              title="Air quality"
              description="Air sensor not connected yet"
              icon="◌"
            />
            <ModuleCard
              eyebrow="Workshop"
              title="3D printer"
              description="Printer status will appear here"
              icon="▱"
            />
          </div>

          <ModuleCard
            eyebrow="Now playing"
            title="Music & speakers"
            description="Connect Spotify or Chromecast to see playback"
            icon="♫"
          />
          <ModuleCard
            eyebrow="Connection"
            title="Network speed"
            description="Speed history is not connected yet"
            icon="⌁"
          />
        </div>

        <footer className="dashboard-footer">
          <span>Smart Home</span>
          <span>Room to add more</span>
        </footer>
      </div>
    </main>
  )
}
