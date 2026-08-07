// The dashboard topbar (app/dashboard/layout.js) already shows the current
// page's title, so this only renders the description/actions row — no `<h1>`
// here, or the title would print twice on every page.
export function PageHeader({ description, actions }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
