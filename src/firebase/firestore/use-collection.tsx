
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    };
    allDescendants?: boolean;
  };
}

export function useCollection<T = any>(
  memoizedTargetRefOrQuery:
    | CollectionReference<DocumentData>
    | Query<DocumentData>
    | null
    | undefined
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // ✅ If no query or ref provided, just skip
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const internalQuery = memoizedTargetRefOrQuery as InternalQuery;
      const isCollectionGroup = internalQuery?._query?.allDescendants === true;

      const path =
        (memoizedTargetRefOrQuery as any).path ||
        internalQuery?._query?.path?.canonicalString?.() ||
        '';

      // 🧩 Path validation — only for normal collections
      if (!isCollectionGroup && (!path || path.trim() === '' || path === '/')) {
        // Instead of logging an error, we just return and set loading to false.
        // This handles cases where dependencies for the query are not ready yet.
        setIsLoading(false);
        setData(null);
        return;
      }

      // ✅ Firestore snapshot listener
      const unsubscribe = onSnapshot(
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const results = snapshot.docs.map((doc) => ({
            ...(doc.data() as T),
            id: doc.id,
          }));
          setData(results);
          setIsLoading(false);
          setError(null);
        },
        (err: FirestoreError) => {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: isCollectionGroup
              ? `CollectionGroup(${internalQuery._query.path.toString()})`
              : path,
          });
          setError(contextualError);
          setData(null);
          setIsLoading(false);
          errorEmitter.emit('permission-error', contextualError);
        }
      );

      // ✅ Cleanup on unmount
      return () => unsubscribe();
    } catch (err: any) {
      console.error('🔥 useCollection Internal Error:', err);
      setError(err);
      setIsLoading(false);
    }
  }, [memoizedTargetRefOrQuery]);

  return { data, isLoading, error };
}
