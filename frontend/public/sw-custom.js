// 20-20-20 백그라운드 타이머 Service Worker
let timerInterval = null;

self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'ENABLE_202020') {
    startTimer();
  }

  if (type === 'DISABLE_202020') {
    stopTimer();
  }
});

function startTimer() {
  stopTimer();
  // 20분(1200초) 간격으로 반복 알림
  timerInterval = setInterval(() => {
    self.registration.showNotification('20-20-20 휴식 시간', {
      body: '20초간 6m 밖을 바라보며 눈을 쉬어주세요.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'eye-rest-202020',
      renotify: true,
      data: { url: '/symptoms' },
    });
  }, 20 * 60 * 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/symptoms';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
