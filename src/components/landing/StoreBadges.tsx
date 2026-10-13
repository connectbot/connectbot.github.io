import Image from 'next/image';

const stores = [
  {
    href: 'https://play.google.com/store/apps/details?id=org.connectbot',
    image: '/badges/google-play.svg',
    label: 'Get it on Google Play',
    className: 'google-play-badge',
    width: 189,
    height: 56,
  },
  {
    href: 'https://f-droid.org/packages/org.connectbot/',
    image: '/badges/f-droid.svg',
    label: 'Get it on F-Droid',
    className: 'f-droid-badge',
    width: 215,
    height: 83,
  },
];

/** Official artwork with matching visible dimensions and brand clear space. */
export function StoreBadges() {
  return (
    <div className="download-badges" aria-label="Download ConnectBot">
      {stores.map(store => (
        <a key={store.href} className="store-badge" href={store.href}>
          <Image
            className={store.className}
            src={store.image}
            alt={store.label}
            width={store.width}
            height={store.height}
            unoptimized
          />
        </a>
      ))}
    </div>
  );
}
