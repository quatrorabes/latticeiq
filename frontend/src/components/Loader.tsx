// frontend/src/components/Loader.tsx
export default function Loader() {
  return (
    <div className="flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  );
}
