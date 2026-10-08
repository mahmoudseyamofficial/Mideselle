'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon, X, ZoomIn } from 'lucide-react'

type ListingImageGalleryProps = {
  photos: string[]
  title: string
  locale: 'ar' | 'en'
  sectionLabel: string
}

export function ListingImageGallery({ photos, title, locale, sectionLabel }: ListingImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 })
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogId = useId()
  const currentIndex = Math.min(activeIndex, Math.max(photos.length - 1, 0))
  const currentPhoto = photos[currentIndex]
  const labels = locale === 'ar'
    ? { zoom: 'تكبير الصورة', close: 'إغلاق الصورة', previous: 'الصورة السابقة', next: 'الصورة التالية', photo: 'الصورة' }
    : { zoom: 'Zoom image', close: 'Close image', previous: 'Previous image', next: 'Next image', photo: 'Photo' }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (lightboxOpen && !dialog.open) dialog.showModal()
    if (!lightboxOpen && dialog.open) dialog.close()
  }, [lightboxOpen])

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + photos.length) % photos.length)
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % photos.length)
  }

  if (photos.length === 0) {
    return (
      <section aria-label={sectionLabel} className="flex flex-col gap-3">
        <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border bg-muted text-muted-foreground">
          <div className="flex flex-col items-center gap-2">
            <ImageIcon aria-hidden="true" />
            <p className="text-sm">{locale === 'ar' ? 'لا توجد صور لهذا الجهاز' : 'No photos available'}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section aria-label={sectionLabel} className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted">
        <button
          type="button"
          aria-label={labels.zoom}
          aria-haspopup="dialog"
          aria-controls={dialogId}
          className="size-full cursor-zoom-in overflow-hidden"
          onClick={() => setLightboxOpen(true)}
          onPointerMove={(event) => {
            if (event.pointerType !== 'mouse') return
            const bounds = event.currentTarget.getBoundingClientRect()
            setZoomPosition({
              x: Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100)),
              y: Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100)),
            })
            setZoomed(true)
          }}
          onPointerLeave={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPhoto}
            alt={title}
            draggable={false}
            className="size-full object-contain transition-transform duration-500 ease-out"
            style={{
              transform: zoomed ? 'scale(1.7)' : 'scale(1)',
              transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`,
            }}
          />
          <span className="pointer-events-none absolute bottom-3 end-3 inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs text-foreground shadow-sm">
            <ZoomIn aria-hidden="true" className="size-3.5" />
            {labels.zoom}
          </span>
        </button>
      </div>

      {photos.length > 1 && (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {photos.map((photo, index) => (
            <li key={`${photo}-${index}`} className="aspect-square">
              <button
                type="button"
                aria-label={`${labels.photo} ${index + 1}`}
                aria-pressed={index === currentIndex}
                className="size-full overflow-hidden rounded-xl border-2 border-transparent bg-muted p-1 aria-pressed:border-primary"
                onClick={() => {
                  setActiveIndex(index)
                  setZoomed(false)
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" loading="lazy" className="size-full object-contain" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={`${dialogId}-title`}
        className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none overflow-hidden border-0 bg-black/95 p-4 text-white sm:p-8"
        onClose={() => setLightboxOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close()
        }}
      >
        <div className="relative flex size-full flex-col items-center justify-center gap-4">
          <h2 id={`${dialogId}-title`} className="sr-only">{title}</h2>
          <button
            type="button"
            aria-label={labels.close}
            className="absolute end-0 top-0 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentPhoto} alt={title} className="max-h-[82dvh] max-w-full object-contain" />
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label={labels.previous}
                className="absolute start-0 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={showPrevious}
              >
                <ChevronLeft aria-hidden="true" className="size-5 rtl:rotate-180" />
              </button>
              <button
                type="button"
                aria-label={labels.next}
                className="absolute end-0 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={showNext}
              >
                <ChevronRight aria-hidden="true" className="size-5 rtl:rotate-180" />
              </button>
              <p className="text-sm text-white/75" aria-live="polite">{currentIndex + 1} / {photos.length}</p>
            </>
          )}
        </div>
      </dialog>
    </section>
  )
}
