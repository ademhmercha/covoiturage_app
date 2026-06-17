export function tripStatusBadgeClass(status) {
  switch (status) {
    case "SCHEDULED":
      return "badge-success";
    case "CANCELLED":
      return "badge-danger";
    case "COMPLETED":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}

export function bookingStatusBadgeClass(status) {
  switch (status) {
    case "PENDING":
      return "badge-warning";
    case "ACCEPTED":
      return "badge-success";
    case "REJECTED":
      return "badge-danger";
    case "CANCELLED":
      return "badge-neutral";
    default:
      return "badge-neutral";
  }
}
