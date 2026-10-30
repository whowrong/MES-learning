import { DeliveryPage } from "./DeliveryPage"
import { useDelivery } from "./useDelivery"

export default function DeliveryRoute() {
  const p = useDelivery()
  return <DeliveryPage {...p} />
}
