export const CSV_SAMPLES = {
  standardHeaders: `活动,姓名,手机,回答,报名类型,审核状态,签到状态,候补转正标记,候补顺序,报名时间,审核时间,签到时间,拒绝原因
秋园,张三,13800001111,第一章,正式,已通过,未到场,否,,2025-06-01 10:00,2025-06-01 10:00,,
索拉里斯星,李四,13800002222,,候补,已通过,未到场,否,1,2025-06-02 11:00,2025-06-02 11:00,,
百年孤独,王五,13800003333,第三章,候补转正,已通过,未到场,是,,2025-06-03 09:00,2025-06-03 09:00,,
秋园,赵六,13800004444,第四章,正式,已通过,已签到,否,,2025-06-04 08:00,2025-06-04 08:00,2025-06-10 19:45,
局外人,钱七,13800005555,,正式,待审核,未到场,否,,2025-06-05 14:00,,,
变形记,孙八,13800006666,,正式,已拒绝,未到场,否,,2025-06-06 15:00,2025-06-06 16:00,,不符合条件`,

  alternativeHeaders: `书名,读者姓名,手机号,备注,报名状态,审核,到场状态,是否候补转正,候补号,创建时间,处理时间,到场时间,原因
追忆似水年华,周九,13800007777,第五章,正式,已通过,已到场,否,,2025-07-01 10:00,2025-07-01 10:00,2025-07-10 19:30,
尤利西斯,吴十,13800008888,,候补,已通过,未到场,否,1,2025-07-02 11:00,2025-07-02 11:00,,`,

  minimalHeaders: `活动,姓名,手机
秋园,甲,13811110001
秋园,乙,13811110002
索拉里斯星,丙,13811110003`,

  mixedEnglishHeaders: `activity,name,phone,answer,signupType,reviewStatus,checkinStatus,wasWaitlisted
秋园,丁,13811110004,第一章,正式,已通过,未到场,false
百年孤独,戊,13811110005,第二章,候补转正,已通过,已签到,true`,

  duplicatesWithinCsv: `活动,姓名,手机,回答
秋园,重复A,13822220001,第一次
秋园,重复A,13822220001,第二次
索拉里斯星,重复B,13822220002,`,

  partialFields: `活动,姓名,手机,签到状态,候补转正标记
秋园,签到用户,13833330001,已到场,否
秋园,转正签到用户,13833330002,已到场,是
百年孤独,转正未签到,13833330003,未到场,是`,

  withWaitlistPosition: `活动,姓名,手机,报名类型,候补顺序
活动A,候1,13844440001,候补,3
活动A,候2,13844440002,候补,1
活动A,候3,13844440003,候补,2`,

  rejectedWithReason: `活动,姓名,手机,审核状态,拒绝原因
活动B,拒1,13855550001,已拒绝,内容不符合
活动B,拒2,13855550002,已拒绝,名额已满
活动C,正1,13855550003,已通过,`,

  chineseVariants: `活动,姓名,手机,签到状态,候补转正
活动D,已签到,13866660001,是,否
活动D,已转正签到,13866660002,已,转正
活动D,已转正未签到,13866660003,否,是`,

  quotedFields: `"活动","姓名","手机","回答"
"秋,园","张,三","13877770001","第,一章"
"索拉里斯""星","李""四","13877770002","第""二章"`
};

export const EXPECTED_AUTO_MAPPING = {
  standard: {
    activity: '0',
    name: '1',
    phone: '2',
    answer: '3',
    signupType: '4',
    reviewStatus: '5',
    checkinStatus: '6',
    wasWaitlisted: '7',
    waitlistPosition: '8',
    signupTime: '9',
    reviewTime: '10',
    checkinTime: '11',
    rejectionReason: '12'
  },
  alternative: {
    activity: '0',
    name: '1',
    phone: '2',
    answer: '3',
    signupType: '4',
    reviewStatus: '5',
    checkinStatus: '6',
    wasWaitlisted: '7',
    waitlistPosition: '8',
    signupTime: '9',
    reviewTime: '10',
    checkinTime: '11',
    rejectionReason: '12'
  },
  minimal: {
    activity: '0',
    name: '1',
    phone: '2'
  }
};

export const BASE_EVENTS = [
  { id: 'csv-ev-1', book: '秋园', host: '阿檀', time: '2025-06-10T19:30', limit: 8, status: '开放报名', reviewRequired: false, seriesId: null },
  { id: 'csv-ev-2', book: '索拉里斯星', host: '老周', time: '2025-06-15T20:00', limit: 10, status: '开放报名', reviewRequired: true, seriesId: null },
  { id: 'csv-ev-3', book: '百年孤独', host: '小林', time: '2025-06-20T19:00', limit: 6, status: '已关闭', reviewRequired: false, seriesId: null }
];

export const BASE_SIGNUPS = [
  { id: 'csv-sg-existing-1', eventId: 'csv-ev-1', name: '现有用户', phone: '13800009999', answer: 'existing', status: '正式', reviewStatus: '已通过', checkedIn: false, checkedInAt: '', _wasWaitlisted: false, readerId: 'csv-rd-existing-1', createdAt: '2025-05-01 10:00' },
  { id: 'csv-sg-existing-2', eventId: 'csv-ev-1', name: '覆盖测试', phone: '13800001111', answer: 'old answer', status: '正式', reviewStatus: '已通过', checkedIn: false, checkedInAt: '', _wasWaitlisted: false, readerId: 'csv-rd-existing-2', createdAt: '2025-05-02 10:00' },
  { id: 'csv-sg-existing-3', eventId: 'csv-ev-1', name: '补签到测试', phone: '13800004444', answer: '赵六原始', status: '正式', reviewStatus: '已通过', checkedIn: false, checkedInAt: '', _wasWaitlisted: false, readerId: 'csv-rd-existing-3', createdAt: '2025-05-03 10:00' }
];

export const BASE_READERS = [
  { id: 'csv-rd-existing-1', name: '现有用户', phone: '13800009999', note: '老读者', tags: ['常客'], createdAt: '2025-01-01', updatedAt: '2025-05-01' },
  { id: 'csv-rd-existing-2', name: '覆盖测试', phone: '13800001111', note: '', tags: [], createdAt: '2025-01-02', updatedAt: '2025-05-02' },
  { id: 'csv-rd-existing-3', name: '补签到测试', phone: '13800004444', note: '', tags: [], createdAt: '2025-01-03', updatedAt: '2025-05-03' }
];

export const MANUAL_MAPPING_NON_STANDARD = {
  '0': 'activity',
  '1': 'name',
  '2': 'phone',
  '3': 'answer',
  '4': 'signupType',
  '5': 'reviewStatus',
  '6': 'checkinStatus',
  '7': 'wasWaitlisted'
};
