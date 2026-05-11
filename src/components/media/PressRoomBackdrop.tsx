'use client'

interface Props {
  /** Fires when the user clicks outside the modal — closes (NOT skip). */
  onBackdropClick: () => void
}

export function PressRoomBackdrop({ onBackdropClick }: Props) {
  return (
    <div
      className="press-backdrop"
      onClick={onBackdropClick}
      aria-hidden="true"
    />
  )
}
