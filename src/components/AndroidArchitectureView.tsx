import React, { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { Download, FileCode2 } from 'lucide-react';

interface BundleFile {
  path: string;
  content: string;
}

export const AndroidArchitectureView: React.FC = () => {
  const [files, setFiles] = useState<BundleFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch('/api/android-bundle')
      .then((res) => res.json())
      .then((data: { files: BundleFile[] }) => {
        setFiles(data.files || []);
        if (data.files && data.files.length > 0) {
          setSelectedPath(data.files[0].path);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedFile = files.find((f) => f.path === selectedPath) || files[0] || null;

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      files.forEach((f) => {
        zip.file(f.path, f.content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'youthgo-android-firebase-project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Android Studio Kotlin & Cloud Functions Source</h1>
          <p className="text-sm text-stone-600 mt-1">
            Complete Jetpack Compose, Hilt, Firebase BoM (Auth, Firestore, Storage, FCM, App Check, Crashlytics, Analytics), Cloud Functions v2, and Firestore Rules source tree.
          </p>
        </div>
        <button
          type="button"
          disabled={downloading || files.length === 0}
          onClick={handleDownloadZip}
          className="px-4 py-2.5 text-xs font-medium bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Packaging ZIP...' : `Download Android Project ZIP (${files.length} files)`}
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-5 text-sm text-stone-700 space-y-2">
        <p className="font-semibold text-stone-900">Real Installable APK (`app-debug.apk`) তৈরি ও ডাউনলোড নির্দেশিকা</p>
        <p className="text-xs text-stone-600 leading-relaxed">
          এই সার্ভারটি Node.js/Vite ওয়েব এনভায়রনমেন্টে চলে (এখানে Java JDK বা Android SDK ইনস্টল করা নেই), তাই সরাসরি এখান থেকে খালি বা ভুয়া <span className="font-mono-tabular">.apk</span> ফাইল তৈরি করা সম্ভব নয়। উপরের সবুজ বাটন থেকে সম্পূর্ণ Android Studio প্রজেক্ট ZIP ডাউনলোড করুন (এতে <span className="font-mono-tabular">.github/workflows/build-apk.yml</span> অটোমেটেড APK বিল্ডারও যুক্ত আছে):
        </p>
        <ul className="text-xs text-stone-600 list-disc pl-5 space-y-1">
          <li><strong>Android Studio দিয়ে:</strong> ZIP আনজিপ করে <span className="font-mono-tabular">android-youthgo/</span> ওপেন করুন, Firebase Console থেকে আপনার Android <span className="font-mono-tabular">google-services.json</span> যোগ করুন এবং <strong>Build &gt; Build APK(s)</strong> বা <span className="font-mono-tabular">gradle assembleDebug</span> চালিয়ে আসল <span className="font-mono-tabular">app-debug.apk</span> পান।</li>
          <li><strong>GitHub Actions দিয়ে (Android Studio ছাড়াই):</strong> <span className="font-mono-tabular">android-youthgo/</span> ফোল্ডারটি GitHub-এ পুশ করলে Actions ট্যাব থেকে <span className="font-mono-tabular">APK_DOWNLOAD/app-debug.apk</span> অটোমেটিক বিল্ড হয়ে ডাউনলোডের জন্য তৈরি হবে।</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-4 bg-white border border-stone-200 rounded-xl p-3 max-h-[640px] overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-xs text-stone-500 p-3">Loading project tree...</p>
          ) : (
            files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setSelectedPath(f.path)}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 transition-colors ${
                  selectedPath === f.path ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-mono-tabular">{f.path}</span>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8 bg-stone-900 text-stone-100 rounded-xl overflow-hidden border border-stone-800">
          <div className="px-4 py-3 border-b border-stone-800 text-xs font-mono-tabular text-stone-400">
            {selectedFile ? selectedFile.path : 'Select a source file'}
          </div>
          <pre className="p-4 text-xs font-mono-tabular overflow-x-auto max-h-[590px] leading-relaxed">
            {selectedFile ? selectedFile.content : ''}
          </pre>
        </div>
      </div>
    </div>
  );
};
