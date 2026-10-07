// High score board backed by Firestore. The SDK is loaded on first use so the game itself never depends on it.
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
const TIMEOUT_MS = 8000;

// Player-chosen names are shown to everyone: strip control characters and angle brackets, collapse spaces, cap at 12 characters.
export function cleanName(s) {
  const t = String(s ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(t).slice(0, 12).join('');
}

const withTimeout = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej({ code: 'timeout' }), TIMEOUT_MS))]);

let ready = null;
function backend() {
  if (globalThis.__LB_MOCK) return Promise.resolve(globalThis.__LB_MOCK); // test hook
  if (!ready) {
    ready = (async () => {
      const [{ initializeApp }, fs] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]);
      const db = fs.getFirestore(initializeApp(firebaseConfig));
      const col = fs.collection(db, 'scores');
      return {
        async submit(name, score) {
          const ref = await fs.addDoc(col, { name, score, createdAt: fs.serverTimestamp() });
          return ref.id;
        },
        async top(n) {
          const snap = await fs.getDocs(fs.query(col, fs.orderBy('score', 'desc'), fs.limit(n)));
          return snap.docs.map(d => ({ id: d.id, name: String(d.data().name ?? ''), score: Number(d.data().score) || 0 }));
        },
        async rank(score) {
          const snap = await fs.getCountFromServer(fs.query(col, fs.where('score', '>', score)));
          return snap.data().count + 1;
        },
      };
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

export const submitScore = async (name, score) => withTimeout(backend().then(b => b.submit(cleanName(name), Math.floor(score))));
export const fetchTop = async (n = 10) => withTimeout(backend().then(b => b.top(n)));
export const rankOf = async score => withTimeout(backend().then(b => b.rank(Math.floor(score))));
