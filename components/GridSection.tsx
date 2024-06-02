import { useContext } from "react"
import { GridContext } from "./providers/GridProvider"
import conf from '@/app/configuration.json'

export default function GridSection({
  xPartitions = 1/2,
  yPartitions = 1/2,
  children,
  className
}: {
  xPartitions?: number,
  yPartitions?: number,
  children: React.ReactNode,
  className?: string
}) {

  const { totalColumns, totalRows } = useContext(GridContext);

  // todo make more clever regarding parts of page..
  // rounded-t-[10px] rounded-b-[10px] 
  return (
    <div className={`
    rounded-md
    p-${conf.Grid.Padding}
    section
    gap-${conf.Grid.Padding}
    col-span-${xPartitions * totalColumns}
    row-span-${yPartitions * totalRows}
    ${className ?? ''}
    flex
    `}>
      {children}
    </div>
  )
}