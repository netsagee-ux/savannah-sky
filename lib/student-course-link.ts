export function studentCoursePath(orderId: string) {
  return '/orders/' + encodeURIComponent(orderId) + '/learn';
}
