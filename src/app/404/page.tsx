import dynamic from 'next/dynamic';

const NotFoundCanvas = dynamic(async () => import('@/components/NotFoundCanvas'), {
  loading: () => <div style={{ height: '200px' }} />,
});

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h1>Page not found</h1>
      <p>Sorry, that page does not exist.</p>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <NotFoundCanvas />
      </div>
    </div>
  );
}
