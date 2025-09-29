import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AlertType = 'success' | 'danger' | 'warning' | 'info';

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  duration?: number; // in ms
}

let alertId = 0;

export const useAlertStore = defineStore('alerts', () => {
  const alerts = ref<Alert[]>([]);

  /**
   * Adds a new alert to the list.
   * @param alert - The alert object to add. It will be assigned a unique ID.
   * @param duration - How long the alert should be visible (in ms). Defaults to 5000.
   */
  const addAlert = (alert: Omit<Alert, 'id'>, duration: number = 5000) => {
    const id = `alert-${alertId++}`;
    alerts.value.push({ ...alert, id });

    setTimeout(() => {
      removeAlert(id);
    }, duration);
  };

  const removeAlert = (id: string) => {
    alerts.value = alerts.value.filter(a => a.id !== id);
  };

  return {
    alerts,
    addAlert,
    removeAlert,
  };
});
