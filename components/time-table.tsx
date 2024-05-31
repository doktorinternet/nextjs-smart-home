import Section from '@/components/section'

export default function TimeTable({ className }: { className: string }) {
  return (
    <Section className={className}>
      <iframe className='time-table w-full h-full'
        src="https://avgangstavla.vasttrafik.se/?source=vasttrafikse-depatureboardlinkgenerator&stopAreaGid=9021014007171000" ></iframe>
    </Section>
  )
}