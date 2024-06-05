'use client'
import { createContext, FC, ReactNode, useEffect, useState } from "react";
import conf from '@/app/configuration.json';

interface ContextProps {
  totalColumns: number,
  totalRows: number,
}

export const GridContext = createContext<ContextProps>({
  totalColumns: 4,
  totalRows: 4,
});

interface Props {
  children?: ReactNode;
}

const GridProvider: FC<Props> = ({ children }) => {
  const [totalColumns] = useState<number>(4);
  const [totalRows] = useState<number>(4);

  const getClassNames = () => {
    return `
    grid-container
    grid 
    w-full 
    h-full
    p-${conf.Grid.Padding}
    gap-${conf.Grid.Padding}
    place-content-stretch
    grid-cols-${totalColumns}
    grid-rows-${totalRows}
    `
  }

  return (
    <GridContext.Provider value={{ totalColumns, totalRows }}>
      <div className={getClassNames()}>
        {children}
      </div>
    </GridContext.Provider>
  );
};

export default GridProvider;