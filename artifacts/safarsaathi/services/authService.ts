import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/config/firebase";

let currentUser: User | null = null;

export async function ensureAnonymousAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    // If already signed in, resolve immediately
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        currentUser = user;
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          currentUser = cred.user;
          resolve(cred.user);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

export function getCurrentUser(): User | null {
  return currentUser ?? auth.currentUser;
}

export function getUserId(): string {
  const user = getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user.uid;
}
