export default function Section({
  xparts,
  yparts,
  children,
  className
}: {
  xparts?: string,
  yparts?: string,
  children: React.ReactNode,
  className?: string
}) {
  // todo make more clever regarding parts of page..
  // rounded-t-[10px] rounded-b-[10px] 
  return <div className={`rounded-md p-12 section ${className}`}>
    {children}
  </div>
}