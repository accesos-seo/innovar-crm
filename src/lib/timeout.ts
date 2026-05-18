export const withTimeout = <T>(promise: PromiseLike<T>, ms: number = 10000): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms. Es posible que el servidor de base de datos esté inactivo o haya problemas de conexión.`));
    }, ms);
    
    // Cast to any to handle Supabase thenables smoothly in TS
    (promise as any)
      .then((value: T) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((reason: any) => {
        clearTimeout(timer);
        reject(reason);
      });
  });
};
