import { iso } from './eventActions.js';

export function createSeedData() {
  const seedBookIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const seedSeriesId = crypto.randomUUID();

  const seedBooks = [
    { id: seedBookIds[0], title: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', question: '你最想讨论哪一章？' },
    { id: seedBookIds[1], title: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', question: '是否读完全文？' },
    { id: seedBookIds[2], title: '浮木', author: '杨本芬', description: '《浮木》是《秋园》的续集，讲述了秋园一家在新中国成立后的生活变迁。', question: '哪个片段最打动你？' },
    { id: seedBookIds[3], title: '我本芬芳', author: '杨本芬', description: '《我本芬芳》讲述了上世纪六七十年代一个女性的婚姻困境。', question: '你如何看待女主角的选择？' },
    { id: seedBookIds[4], title: '三体', author: '刘慈欣', description: '《三体》是刘慈欣的科幻代表作，讲述了人类与外星文明的首次接触。', question: '你认为黑暗森林法则成立吗？' },
    { id: seedBookIds[5], title: '百年孤独', author: '加西亚·马尔克斯', description: '《百年孤独》是魔幻现实主义文学的代表作，讲述了布恩迪亚家族七代人的传奇故事。', question: '你如何理解书中的孤独主题？' }
  ];

  const seedEvents = [
    { id: crypto.randomUUID(), book: '秋园', author: '杨本芬', description: '《秋园》是作家杨本芬的处女作，讲述了一位普通女性在时代洪流中艰难生存的故事。', host: '店员阿檀', time: `${iso(3)}T19:30`, limit: 8, question: '你最想讨论哪一章？', status: '开放报名', reviewRequired: false, seriesId: seedSeriesId, seriesIndex: 1, _fromTemplate: true, _templateBookId: seedBookIds[0] },
    { id: crypto.randomUUID(), book: '浮木', author: '杨本芬', description: '《浮木》是《秋园》的续集，讲述了秋园一家在新中国成立后的生活变迁。', host: '店员阿檀', time: `${iso(10)}T19:30`, limit: 8, question: '哪个片段最打动你？', status: '开放报名', reviewRequired: false, seriesId: seedSeriesId, seriesIndex: 2, _fromTemplate: true, _templateBookId: seedBookIds[2] },
    { id: crypto.randomUUID(), book: '我本芬芳', author: '杨本芬', description: '《我本芬芳》讲述了上世纪六七十年代一个女性的婚姻困境。', host: '店员阿檀', time: `${iso(17)}T19:30`, limit: 8, question: '你如何看待女主角的选择？', status: '开放报名', reviewRequired: false, seriesId: seedSeriesId, seriesIndex: 3, _fromTemplate: true, _templateBookId: seedBookIds[3] },
    { id: crypto.randomUUID(), book: '索拉里斯星', author: '斯坦尼斯瓦夫·莱姆', description: '《索拉里斯星》是波兰科幻作家莱姆的代表作，探讨了人类与外星文明沟通的困境。', host: '老周', time: `${iso(5)}T20:00`, limit: 12, question: '是否读完全文？', status: '开放报名', reviewRequired: false }
  ];

  const seedSeries = [
    { id: seedSeriesId, title: '杨本芬女性三部曲', description: '连续三周共读杨本芬笔下的女性故事，感受大时代背景下普通人的命运浮沉。', createdAt: new Date().toLocaleString() }
  ];

  return { seedBooks, seedEvents, seedSeries, seedBookIds, seedSeriesId };
}

export function createInitialForms() {
  const defaultTime = `${iso(7)}T19:30`;

  return {
    eventForm: { book: '', author: '', description: '', host: '', time: defaultTime, limit: 10, question: '', status: '开放报名', reviewRequired: false },
    bookForm: { title: '', author: '', description: '', question: '' },
    signupForm: { name: '', phone: '', answer: '' },
    seriesForm: { title: '', description: '' },
    seriesEventForm: { book: '', author: '', description: '', host: '', time: defaultTime, limit: 10, question: '', status: '开放报名', reviewRequired: false },
    batchCreateForm: {
      bookIds: [],
      host: '',
      limit: 10,
      question: '',
      startDate: defaultTime,
      intervalDays: 7,
      status: '开放报名',
      reviewRequired: false
    },
    batchUpdateForm: {
      host: '',
      limit: null,
      status: null,
      reviewRequired: null
    },
    reviewForm: {
      note: '',
      onSiteCount: '',
      walkInCount: '',
      absenceReasons: '',
      followUpReaders: '',
      recommendedBooks: ''
    }
  };
}

export function getDefaultEventTime(daysOffset = 7) {
  return `${iso(daysOffset)}T19:30`;
}
