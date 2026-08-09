import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { SectionHeading } from '@/components/common/section-heading'
import { CopyAddressButton } from '@/components/contact/copy-address-button'
import { isValidGoogleMapsUrl } from '@/lib/validate-url'
import type { ContactSettingsValue } from '@/lib/types'

interface LocationCms {
  headline?: string
  address_note?: string
  parking?: string
  public_transport?: string
}

interface Props {
  location: Pick<
    ContactSettingsValue,
    | 'locationTitle'
    | 'locationDescription'
    | 'addressLine1'
    | 'addressLine2'
    | 'city'
    | 'postcode'
    | 'country'
    | 'googleMapsUrl'
    | 'locationImageUrl'
    | 'locationImageAlt'
  >
  cms?: LocationCms
}

/**
 * Static "Kde nás najdete" block for the public Contact page.
 *
 * Deliberately NOT an embedded/interactive map — a photo of the property plus
 * a direct link out to Google Maps, per the brand's editorial design language.
 *
 * Renders nothing if there is no location content at all (no seed/demo
 * placeholders are ever shown publicly). Renders whatever subset of fields
 * is actually configured — image, address lines and the Maps CTA are all
 * independently optional.
 */
export function ContactLocation({ location, cms }: Props) {
  const {
    locationTitle,
    locationDescription,
    addressLine1,
    addressLine2,
    city,
    postcode,
    country,
    googleMapsUrl,
    locationImageUrl,
    locationImageAlt,
  } = location

  const hasAddress = Boolean(addressLine1 || addressLine2 || city || postcode || country)
  const hasImage = Boolean(locationImageUrl)
  // Defense in depth: re-validate on the read path in case a row was ever
  // written outside the admin action (e.g. directly in the DB).
  const hasMapsLink = Boolean(googleMapsUrl && isValidGoogleMapsUrl(googleMapsUrl))

  const practicalInfo = [cms?.address_note, cms?.parking, cms?.public_transport].filter(
    (item): item is string => Boolean(item),
  )

  if (!hasAddress && !hasImage && !hasMapsLink && !locationDescription && practicalInfo.length === 0) {
    return null
  }

  const plainAddress = [addressLine1, addressLine2, [city, postcode].filter(Boolean).join(' '), country]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="bg-secondary paper-texture py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`overflow-hidden rounded-3xl border border-border bg-card ${
            hasImage ? 'lg:grid lg:grid-cols-2' : ''
          }`}
        >
          {hasImage && (
            <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[420px]">
              <Image
                src={locationImageUrl as string}
                alt={locationImageAlt || 'Fotografie hotelu VERDE a jeho okolí'}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
                unoptimized={(locationImageUrl as string).startsWith('http')}
              />
            </div>
          )}

          <div className="flex flex-col justify-center gap-6 p-8 sm:p-10 lg:p-14">
            <SectionHeading
              eyebrow="Lokalita"
              title={cms?.headline || locationTitle || 'Kde nás najdete'}
              withSprig
            />

            {hasAddress && (
              <address className="not-italic text-base leading-relaxed text-verde-deep">
                <p className="font-serif text-lg font-semibold">VERDE Hotel pro psy</p>
                {addressLine1 && <span className="block">{addressLine1}</span>}
                {addressLine2 && <span className="block">{addressLine2}</span>}
                {(city || postcode) && (
                  <span className="block">{[postcode, city].filter(Boolean).join(' ')}</span>
                )}
                {country && <span className="block">{country}</span>}
              </address>
            )}

            {locationDescription && (
              <p className="max-w-md text-pretty text-sm leading-relaxed text-verde-moss">
                {locationDescription}
              </p>
            )}

            {practicalInfo.length > 0 && (
              <ul className="flex flex-col gap-2">
                {practicalInfo.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-verde-moss">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-verde-green" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}

            {(hasMapsLink || hasAddress) && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {hasMapsLink && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Otevřít polohu VERDE Hotel pro psy v Google Maps"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-verde-green px-6 py-2.5 text-sm font-semibold text-verde-white transition-colors hover:bg-verde-deep"
                  >
                    <MapPin className="size-4" aria-hidden="true" />
                    Zobrazit v Google Maps
                  </a>
                )}
                {hasAddress && <CopyAddressButton address={plainAddress} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
