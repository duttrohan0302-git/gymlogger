export const MUSCLE_LABELS = {
  back: 'Back', biceps: 'Biceps', chest: 'Chest', triceps: 'Triceps',
  shoulders: 'Shoulders', abs: 'Abs', legs: 'Legs',
}

export const MUSCLE_COLORS = {
  back: '#3b82f6', biceps: '#8b5cf6', chest: '#ef4444', triceps: '#f97316',
  shoulders: '#eab308', abs: '#ec4899', legs: '#10b981',
}

export const EXERCISES = [
  // BACK
  { id: 'chest_supported_row', name: 'Chest Supported Row', muscleGroup: 'back', movementGroupId: 'row', notes: '' },
  { id: 'lat_pulldown', name: 'Lat Pull Down', muscleGroup: 'back', movementGroupId: 'lat_pull', notes: '' },
  { id: 'back_extension', name: 'Back Extension', muscleGroup: 'back', movementGroupId: null, notes: '' },
  { id: 'diverging_lat_pulldown', name: 'Diverging Lat Pulldown', muscleGroup: 'back', movementGroupId: 'lat_pull', notes: '' },
  { id: 'diverging_seated_row', name: 'Diverging Seated Row', muscleGroup: 'back', movementGroupId: 'row', notes: '' },
  { id: 'low_rows_v_bar', name: 'Low Rows V Bar', muscleGroup: 'back', movementGroupId: 'row', notes: '' },
  { id: 'dumbbell_shrugs', name: 'Dumbbell Shrugs', muscleGroup: 'back', movementGroupId: null, notes: '' },
  // BICEPS
  { id: 'cable_unilateral_curl', name: 'Cable Unilateral Curl', muscleGroup: 'biceps', movementGroupId: 'bicep_curl', notes: 'Weaker left arm' },
  { id: 'inclined_curl_db', name: 'Inclined Sitting Curl', muscleGroup: 'biceps', movementGroupId: 'bicep_curl', notes: 'Bench position 3' },
  { id: 'preacher_curl', name: 'Preacher Curl Single Arm', muscleGroup: 'biceps', movementGroupId: 'bicep_curl', notes: '' },
  { id: 'rope_hammer_curl', name: 'Rope Hammer Curl', muscleGroup: 'biceps', movementGroupId: 'hammer_curl', notes: '' },
  { id: 'cross_body_hammer_curl', name: 'Cross Body Hammer Curl', muscleGroup: 'biceps', movementGroupId: 'hammer_curl', notes: '' },
  { id: 'sitting_hammer_curl', name: 'Sitting Hammer Curl', muscleGroup: 'biceps', movementGroupId: 'hammer_curl', notes: '' },
  // SHOULDERS
  { id: 'shoulder_press_db', name: 'Shoulder Press Dumbbell', muscleGroup: 'shoulders', movementGroupId: 'shoulder_press', notes: '' },
  { id: 'cable_lateral_raise', name: 'Cable Lateral Raise', muscleGroup: 'shoulders', movementGroupId: 'lateral_raise', notes: 'High reps, low weight' },
  { id: 'archer_pull', name: 'Archer Pull Single Arm', muscleGroup: 'shoulders', movementGroupId: 'rear_delt', notes: '' },
  { id: 'facepulls', name: 'Facepulls', muscleGroup: 'shoulders', movementGroupId: 'rear_delt', notes: '' },
  { id: 'rear_delt_machine', name: 'Rear Delt Machine', muscleGroup: 'shoulders', movementGroupId: 'rear_delt', notes: 'Hard to maintain form' },
  { id: 'machine_shoulder_press', name: 'Machine Shoulder Press', muscleGroup: 'shoulders', movementGroupId: 'shoulder_press', notes: '' },
  { id: 'lateral_raise_db', name: 'Lateral Raise Dumbbell', muscleGroup: 'shoulders', movementGroupId: 'lateral_raise', notes: '' },
  { id: 'rear_delt_dual_cable', name: 'Rear Delt Dual Cable', muscleGroup: 'shoulders', movementGroupId: 'rear_delt', notes: '' },
  // ABS
  { id: 'abs_crunch_rope', name: 'Abs Crunch Rope', muscleGroup: 'abs', movementGroupId: 'core', notes: 'Stop at full extension' },
  { id: 'rotary_torso', name: 'Rotary Torso', muscleGroup: 'abs', movementGroupId: 'core', notes: '' },
  { id: 'hanging_leg_raises', name: 'Hanging Leg Raises', muscleGroup: 'abs', movementGroupId: 'core', notes: '' },
  // CHEST
  { id: 'inclined_db_press', name: 'Inclined Dumbbell Press', muscleGroup: 'chest', movementGroupId: 'press', notes: 'Do this first' },
  { id: 'chest_press_machine', name: 'Chest Press Machine', muscleGroup: 'chest', movementGroupId: 'press', notes: '' },
  { id: 'pec_fly_machine', name: 'Pec Fly Machine', muscleGroup: 'chest', movementGroupId: 'fly', notes: '' },
  { id: 'bench_press', name: 'Bench Press', muscleGroup: 'chest', movementGroupId: 'press', notes: '' },
  { id: 'dumbbell_press', name: 'Dumbbell Press', muscleGroup: 'chest', movementGroupId: 'press', notes: '' },
  { id: 'supine_press', name: 'Supine Press', muscleGroup: 'chest', movementGroupId: 'press', notes: '' },
  { id: 'cable_fly', name: 'Cable Fly High to Low', muscleGroup: 'chest', movementGroupId: 'fly', notes: '' },
  { id: 'smith_machine_chest', name: 'Smith Machine', muscleGroup: 'chest', movementGroupId: 'press', notes: '' },
  // TRICEPS
  { id: 'tricep_overhead_single', name: 'Triceps Overhead Single Arm', muscleGroup: 'triceps', movementGroupId: 'tricep_overhead', notes: '' },
  { id: 'tricep_overhead_rope', name: 'Tricep Overhead Rope Extension', muscleGroup: 'triceps', movementGroupId: 'tricep_overhead', notes: '' },
  { id: 'tricep_straight_bar', name: 'Tricep Straight Bar Pushdown', muscleGroup: 'triceps', movementGroupId: 'tricep_pushdown', notes: '' },
  { id: 'tricep_single_arm_ext', name: 'Tricep Single Arm Extension', muscleGroup: 'triceps', movementGroupId: 'tricep_pushdown', notes: 'Handle normally, not sideways' },
  { id: 'weighted_dips', name: 'Weighted Dips', muscleGroup: 'triceps', movementGroupId: null, notes: 'Do first' },
  { id: 'tricep_triangle_overhead', name: 'Tricep Triangle Bar Overhead', muscleGroup: 'triceps', movementGroupId: 'tricep_overhead', notes: '' },
  // LEGS
  { id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', muscleGroup: 'legs', movementGroupId: 'squat', notes: "Box at 24cm height, don't go too low" },
  { id: 'stand_knee_raise', name: 'Stand Knee Raise', muscleGroup: 'legs', movementGroupId: 'squat', notes: '' },
  { id: 'barbell_squat', name: 'Barbell Squat', muscleGroup: 'legs', movementGroupId: 'squat', notes: '' },
  { id: 'hip_thrust_single_leg', name: 'Hip Thrust Single Leg', muscleGroup: 'legs', movementGroupId: 'hip_hinge', notes: 'One leg straight, 8 reps each leg' },
  { id: 'hack_squat', name: 'Hack Squat Machine', muscleGroup: 'legs', movementGroupId: 'squat', notes: 'Start 47.6kg, legs lower for quads' },
  { id: 'rdl_dumbbell', name: 'RDL Dumbbell', muscleGroup: 'legs', movementGroupId: 'hip_hinge', notes: '' },
  { id: 'leg_press_sitting', name: 'Leg Press (Sitting)', muscleGroup: 'legs', movementGroupId: 'leg_press', notes: 'Pin in 6th hole' },
  { id: 'leg_press_lying', name: 'Leg Press (Lying)', muscleGroup: 'legs', movementGroupId: 'leg_press', notes: 'Start 75.7kg' },
  { id: 'leg_curl', name: 'Leg Curl', muscleGroup: 'legs', movementGroupId: null, notes: '' },
  { id: 'leg_extension', name: 'Leg Extension', muscleGroup: 'legs', movementGroupId: null, notes: '' },
  { id: 'calves', name: 'Calves', muscleGroup: 'legs', movementGroupId: null, notes: 'Sitting start 11.3kg, standing 27.3kg' },
  { id: 'hip_abductor', name: 'Hip Abductor', muscleGroup: 'legs', movementGroupId: null, notes: '' },
]

export const MOVEMENT_GROUPS = [
  { id: 'row', name: 'Row', exerciseIds: ['chest_supported_row', 'diverging_seated_row', 'low_rows_v_bar'] },
  { id: 'lat_pull', name: 'Lat Pull', exerciseIds: ['lat_pulldown', 'diverging_lat_pulldown'] },
  { id: 'rear_delt', name: 'Rear Delt', exerciseIds: ['facepulls', 'rear_delt_machine', 'archer_pull', 'rear_delt_dual_cable'] },
  { id: 'bicep_curl', name: 'Bicep Curl', exerciseIds: ['cable_unilateral_curl', 'inclined_curl_db', 'preacher_curl'] },
  { id: 'hammer_curl', name: 'Hammer Curl', exerciseIds: ['rope_hammer_curl', 'cross_body_hammer_curl', 'sitting_hammer_curl'] },
  { id: 'shoulder_press', name: 'Shoulder Press', exerciseIds: ['shoulder_press_db', 'machine_shoulder_press'] },
  { id: 'lateral_raise', name: 'Lateral Raise', exerciseIds: ['cable_lateral_raise', 'lateral_raise_db'] },
  { id: 'core', name: 'Core', exerciseIds: ['abs_crunch_rope', 'rotary_torso', 'hanging_leg_raises'] },
  { id: 'press', name: 'Chest Press', exerciseIds: ['inclined_db_press', 'chest_press_machine', 'bench_press', 'dumbbell_press', 'supine_press', 'smith_machine_chest'] },
  { id: 'fly', name: 'Chest Fly', exerciseIds: ['pec_fly_machine', 'cable_fly'] },
  { id: 'tricep_overhead', name: 'Tricep Overhead', exerciseIds: ['tricep_overhead_single', 'tricep_overhead_rope', 'tricep_triangle_overhead'] },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown', exerciseIds: ['tricep_straight_bar', 'tricep_single_arm_ext'] },
  { id: 'squat', name: 'Squat', exerciseIds: ['bulgarian_split_squat', 'stand_knee_raise', 'barbell_squat', 'hack_squat'] },
  { id: 'hip_hinge', name: 'Hip Hinge', exerciseIds: ['hip_thrust_single_leg', 'rdl_dumbbell'] },
  { id: 'leg_press', name: 'Leg Press', exerciseIds: ['leg_press_sitting', 'leg_press_lying'] },
]

export const DEFAULT_SPLIT = {
  id: 'default',
  name: '4-Day Split',
  isActive: true,
  days: [
    { id: 'back_biceps', name: 'Back + Biceps', muscleGroups: ['back', 'biceps'] },
    { id: 'chest_triceps', name: 'Chest + Triceps', muscleGroups: ['chest', 'triceps'] },
    { id: 'shoulders_abs', name: 'Shoulders + Abs', muscleGroups: ['shoulders', 'abs'] },
    { id: 'legs', name: 'Legs', muscleGroups: ['legs'] },
  ],
}

export const MUSCLE_NOTES = {
  back: 'Pull-ups on back day — try extending arms fully',
  biceps: 'Left bicep is weaker than right',
  shoulders: '5 min warmup. Do dumbbell overhead press.',
  abs: 'Try decline crunches — very low movement',
  chest: 'Do incline dumbbell first. Use pec fly machine not cables for flys.',
  triceps: 'Order: dips → both arm pushdown → overhead extension → single arm pushdown',
  legs: '1. Use free barbell squat. 2. Hip thrust: one leg straight, no weight, 8 reps each. 3. Bulgarian: box 24cm, don\'t go too low.',
}

export const EMPTY_DATA = {
  version: 1,
  splits: [DEFAULT_SPLIT],
  exercises: EXERCISES,
  movementGroups: MOVEMENT_GROUPS,
  muscleGroupNotes: MUSCLE_NOTES,
  sessions: [],
  bodyWeightLog: [],
}
