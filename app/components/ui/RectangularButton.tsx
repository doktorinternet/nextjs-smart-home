'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import styles from './RectangularButton.module.css'

const RectangularButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function RectangularButton({ className, type = 'button', ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`${styles.button}${className ? ` ${className}` : ''}`}
      />
    )
  },
)

RectangularButton.displayName = 'RectangularButton'

export default RectangularButton