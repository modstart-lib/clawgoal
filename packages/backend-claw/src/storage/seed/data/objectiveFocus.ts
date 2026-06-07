import { daysAgo, hoursAgo } from '../../../../../backend/src/storage/seed/util'

/** 对应新的 claw_objective_focus 表（action_ids + time） */
export const objectiveFocuses = [
    {
        id: 1,
        actionIds: JSON.stringify([3, 6, 10]),
        time: daysAgo(1),
        createdAt: daysAgo(1),
    },
    {
        id: 2,
        actionIds: JSON.stringify([5, 8, 11]),
        time: hoursAgo(5),
        createdAt: hoursAgo(5),
    },
]
