export const enum NumberType {
    i32 = 0x7F,
    i64 = 0x7E,
    f32 = 0x7D,
    f64 = 0x7C,
}

export const enum VectorType {
    v128 = 0x7B,
}

export const enum ReferenceType {
    funcref = 0x70,
    externref = 0x6F,
}

export type ValueType = NumberType | ReferenceType;

export type ResultType = ValueType[];
export type FunctionType = { parameters: ResultType, result: ResultType };

export type Limits = { min: number, max?: number };

export type MemType = Limits

export type Member = { limits: Limits };

export const enum Mut {
    Const = 0x00,
    Var = 0x01
}

export const enum EmptyBlock {
    Empty = 0x40,
}

export type BlockType = EmptyBlock | ValueType | number;

export type TypeIndex = number
export type FuncIndex = number
export type TableIndex = number
export type MemIndex = number
export type GlobalIndex = number
export type ElementIndex = number
export type DataIndex = number
export type LocalIndex = number
export type LabelIndex = number

export interface TableType {
    ref: ReferenceType;
    lim: Limits;
}

export const enum SectionIndex {
    Custom = 0,
    Type = 1,
    Import = 2,
    Function = 3,
    Table = 4,
    Memory = 5,
    Global = 6,
    Export = 7,
    Start = 8,
    Element = 9,
    Code = 10,
    Data = 11,
    DataCount = 12,
}

export const enum Inst {
    Extended = 0xFC,
    Vector = 0xFD,

    // Control
    Unreachable = 0x00,
    Nop = 0x01,
    Block = 0x02,
    Loop = 0x03,
    If = 0x04,
    Else = 0x05,
    End = 0x0B,
    Br = 0x0C,
    Br_if = 0x0D,
    Br_table = 0x0E,
    Return = 0x0F,
    Call = 0x10,
    Call_indirect = 0x11,

    // Reference
    Ref_null = 0xD0,
    Ref_is_null = 0xD1,
    Ref_func = 0xD2,

    // Parametric Instructions
    Drop = 0x1A,
    Select = 0x1B,
    Select_t = 0x1C,

    // Variable Instructions
    Local_get = 0x20,
    Local_set = 0x21,
    Local_tee = 0x22,
    Global_get = 0x23,
    Global_set = 0x24,

    // Table Instructions
    Table_get = 0x25,
    Table_set = 0x26,
    Table_init = 0x12,
    Elem_drop = 0x13,
    Table_copy = 0x14,
    Table_grow = 0x15,
    Table_size = 0x16,
    Table_fill = 0x17,

    // Memory Instructions
    i32_load = 0x28,
    i64_load = 0x29,
    f32_load = 0x2A,
    f64_load = 0x2B,
    i32_load8_s = 0x2C,
    i32_load8_u = 0x2D,
    i32_load16_s = 0x2E,
    i32_load16_u = 0x2F,
    i64_load8_s = 0x30,
    i64_load8_u = 0x31,
    i64_load16_s = 0x32,
    i64_load16_u = 0x33,
    i64_load32_s = 0x34,
    i64_load32_u = 0x35,
    i32_store = 0x36,
    i64_store = 0x37,
    f32_store = 0x38,
    f64_store = 0x39,
    i32_store8 = 0x3A,
    i32_store16 = 0x3B,
    i64_store8 = 0x3C,
    i64_store16 = 0x3D,
    i64_store32 = 0x3E,
    Memory_size = 0x3F,
    Memory_grow = 0x40,
    Memory_init = 8,
    Data_drop = 9,
    Memory_copy = 10,
    Memory_fill = 11,

    // Numeric instructions
    i32_const = 0x41,
    i64_const = 0x42,
    f32_const = 0x43,
    f64_const = 0x44,

    i32_eqz = 0x45,
    i32_eq = 0x46,
    i32_ne = 0x47,
    i32_lt_s = 0x48,
    i32_lt_u = 0x49,
    i32_gt_s = 0x4A,
    i32_gt_u = 0x4B,
    i32_le_s = 0x4C,
    i32_le_u = 0x4D,
    i32_ge_s = 0x4E,
    i32_ge_u = 0x4F,

    i64_eqz = 0x50,
    i64_eq = 0x51,
    i64_ne = 0x52,
    i64_lt_s = 0x53,
    i64_lt_u = 0x54,
    i64_gt_s = 0x55,
    i64_gt_u = 0x56,
    i64_le_s = 0x57,
    i64_le_u = 0x58,
    i64_ge_s = 0x59,
    i64_ge_u = 0x5A,

    f32_eq = 0x5B,
    f32_ne = 0x5C,
    f32_lt = 0x5D,
    f32_gt = 0x5E,
    f32_le = 0x5F,
    f32_ge = 0x60,

    f64_eq = 0x61,
    f64_ne = 0x62,
    f64_lt = 0x63,
    f64_gt = 0x64,
    f64_le = 0x65,
    f64_ge = 0x66,

    i32_clz = 0x67,
    i32_ctz = 0x68,
    i32_popcnt = 0x69,
    i32_add = 0x6A,
    i32_sub = 0x6B,
    i32_mul = 0x6C,
    i32_div_s = 0x6D,
    i32_div_u = 0x6E,
    i32_rem_s = 0x6F,
    i32_rem_u = 0x70,
    i32_and = 0x71,
    i32_or = 0x72,
    i32_xor = 0x73,
    i32_shl = 0x74,
    i32_shr_s = 0x75,
    i32_shr_u = 0x76,
    i32_rotl = 0x77,
    i32_rotr = 0x78,

    i64_clz = 0x79,
    i64_ctz = 0x7A,
    i64_popcnt = 0x7B,
    i64_add = 0x7C,
    i64_sub = 0x7D,
    i64_mul = 0x7E,
    i64_div_s = 0x7F,
    i64_div_u = 0x80,
    i64_rem_s = 0x81,
    i64_rem_u = 0x82,
    i64_and = 0x83,
    i64_or = 0x84,
    i64_xor = 0x85,
    i64_shl = 0x86,
    i64_shr_s = 0x87,
    i64_shr_u = 0x88,
    i64_rotl = 0x89,
    i64_rotr = 0x8A,

    f32_abs = 0x8B,
    f32_neg = 0x8C,
    f32_ceil = 0x8D,
    f32_floor = 0x8E,
    f32_trunc = 0x8F,
    f32_nearest = 0x90,
    f32_sqrt = 0x91,
    f32_add = 0x92,
    f32_sub = 0x93,
    f32_mul = 0x94,
    f32_div = 0x95,
    f32_min = 0x96,
    f32_max = 0x97,
    f32_copysign = 0x98,

    f64_abs = 0x99,
    f64_neg = 0x9A,
    f64_ceil = 0x9B,
    f64_floor = 0x9C,
    f64_trunc = 0x9D,
    f64_nearest = 0x9E,
    f64_sqrt = 0x9F,
    f64_add = 0xA0,
    f64_sub = 0xA1,
    f64_mul = 0xA2,
    f64_div = 0xA3,
    f64_min = 0xA4,
    f64_max = 0xA5,
    f64_copysign = 0xA6,

    i32_wrap_i64 = 0xA7,
    i32_trunc_f32_s = 0xA8,
    i32_trunc_f32_u = 0xA9,
    i32_trunc_f64_s = 0xAA,
    i32_trunc_f64_u = 0xAB,
    i64_extend_i32_s = 0xAC,
    i64_extend_i32_u = 0xAD,
    i64_trunc_f32_s = 0xAE,
    i64_trunc_f32_u = 0xAF,
    i64_trunc_f64_s = 0xB0,
    i64_trunc_f64_u = 0xB1,
    f32_convert_i32_s = 0xB2,
    f32_convert_i32_u = 0xB3,
    f32_convert_i64_s = 0xB4,
    f32_convert_i64_u = 0xB5,
    f32_demote_f64 = 0xB6,
    f64_convert_i32_s = 0xB7,
    f64_convert_i32_u = 0xB8,
    f64_convert_i64_s = 0xB9,
    f64_convert_i64_u = 0xBA,
    f64_promote_f32 = 0xBB,
    i32_reinterpret_f32 = 0xBC,
    i64_reinterpret_f64 = 0xBD,
    f32_reinterpret_i32 = 0xBE,
    f64_reinterpret_i64 = 0xBF,

    i32_extend8_s = 0xC0,
    i32_extend16_s = 0xC1,
    i64_extend8_s = 0xC2,
    i64_extend16_s = 0xC3,
    i64_extend32_s = 0xC4,

    i32_trunc_sat_f32_s = 0,
    i32_trunc_sat_f32_u = 1,
    i32_trunc_sat_f64_s = 2,
    i32_trunc_sat_f64_u = 3,
    i64_trunc_sat_f32_s = 4,
    i64_trunc_sat_f32_u = 5,
    i64_trunc_sat_f64_s = 6,
    i64_trunc_sat_f64_u = 7,

    v128_load_= 0,
    v128_load8x8_s = 1,
    v128_load8x8_u = 2,
    v128_load16x4_s = 3,
    v128_load16x4_u = 4,
    v128_load32x2_s = 5,
    v128_load32x2_u = 6,
    v128_load8_splat = 7,
    v128_load16_splat = 8,
    v128_load32_splat = 9,
    v128_load64_splat = 10,
    v128_load32_zero = 92,
    v128_load64_zero = 93,
    v128_store = 11,
    v128_load8_lane = 84,
    v128_load16_lane = 85,
    v128_load32_lane = 86,
    v128_load64_lane = 87,
    v128_store8_lane = 88,
    v128_store16_lane = 89,
    v128_store32_lane = 90,
    v128_store64_lane = 91,

    v128_const = 12,

    i8x16_shuffle = 13,

    i8x16_extract_lane_s = 21,
    i8x16_extract_lane_u = 22,
    i8x16_replace_lane = 23,
    i16x8_extract_lane_s = 24,
    i16x8_extract_lane_u = 25,
    i16x8_replace_lane = 26,
    i32x4_extract_lane = 27,
    i32x4_replace_lane = 28,
    i64x2_extract_lane = 29,
    i64x2_replace_lane = 30,
    f32x4_extract_lane = 31,
    f32x4_replace_lane = 32,
    f64x2_extract_lane = 33,
    f64x2_replace_lane = 34,

    i8x16_swizzle = 14,
    i8x16_splat = 15,
    i16x8_splat = 16,
    i32x4_splat = 17,
    i64x2_splat = 18,
    f32x4_splat = 19,
    f64x2_splat = 20,

    i8x16_eq = 35,
    i8x16_ne = 36,
    i8x16_lt_s = 37,
    i8x16_lt_u = 38,
    i8x16_gt_s = 39,
    i8x16_gt_u = 40,
    i8x16_le_s = 41,
    i8x16_le_u = 42,
    i8x16_ge_s = 43,
    i8x16_ge_u = 44,

    i16x8_eq = 45,
    i16x8_ne = 46,
    i16x8_lt_s = 47,
    i16x8_lt_u = 48,
    i16x8_gt_s = 49,
    i16x8_gt_u = 50,
    i16x8_le_s = 51,
    i16x8_le_u = 52,
    i16x8_ge_s = 53,
    i16x8_ge_u = 54,

    i32x4_eq = 55,
    i32x4_ne = 56,
    i32x4_lt_s = 57,
    i32x4_lt_u = 58,
    i32x4_gt_s = 59,
    i32x4_gt_u = 60,
    i32x4_le_s = 61,
    i32x4_le_u = 62,
    i32x4_ge_s = 63,
    i32x4_ge_u = 64,

    i64x2_eq = 214,
    i64x2_ne = 215,
    i64x2_lt_s = 216,
    i64x2_gt_s = 217,
    i64x2_le_s = 218,
    i64x2_ge_s = 219,

    f32x4_eq = 65,
    f32x4_ne = 66,
    f32x4_lt = 67,
    f32x4_gt = 68,
    f32x4_le = 69,
    f32x4_ge = 70,

    f64x2_eq = 71,
    f64x2_ne = 72,
    f64x2_lt = 73,
    f64x2_gt = 74,
    f64x2_le = 75,
    f64x2_ge = 76,

    v128_not = 77,
    v128_and = 78,
    v128_andnot = 79,
    v128_or = 80,
    v128_xor = 81,
    v128_bitselect = 82,
    v128_any_true = 83,

    i8x16_abs = 96,
    i8x16_neg = 97,
    i8x16_popcnt = 98,
    i8x16_all_true = 99,
    i8x16_bitmask = 100,
    i8x16_narrow_i16x8_s = 101,
    i8x16_narrow_i16x8_u = 102,
    i8x16_shl = 107,
    i8x16_shr_s = 108,
    i8x16_shr_u = 109,
    i8x16_add = 110,
    i8x16_sat_s = 111,
    i8x16_sat_u = 112,
    i8x16_sub = 113,
    i8x16_sub_sat_s = 114,
    i8x16_sub_sat_u = 115,
    i8x16_min_s = 118,
    i8x16_min_u = 119,
    i8x16_max_s = 120,
    i8x16_max_u = 121,
    i8x16_avgr_u = 123,

    i16x8_extadd_pairwise_i8x16_s = 124,
    i16x8_extadd_pairwise_i8x16_u = 125,
    i16x8_abs = 128,
    i16x8_neg = 129,
    i16x8_q15mulr_sat_s = 130,
    i16x8_all_true = 131,
    i16x8_bitmask = 132,
    i16x8_narrow_i32x4_s = 133,
    i16x8_narrow_i32x4_u = 134,
    i16x8_extend_low_i8x16_s = 135,
    i16x8_extend_high_i8x16_s = 136,
    i16x8_extend_low_i8x16_u = 137,
    i16x8_extend_high_i8x16_u = 138,
    i16x8_shl = 139,
    i16x8_shr_s = 140,
    i16x8_shr_u = 141,
    i16x8_add = 142,
    i16x8_add_sat_s = 143,
    i16x8_add_sat_u = 144,
    i16x8_sub = 145,
    i16x8_sub_sat_s = 146,
    i16x8_sub_sat_u = 147,
    i16x8_mul = 149,
    i16x8_min_s = 150,
    i16x8_min_u = 151,
    i16x8_max_s = 152,
    i16x8_max_u = 153,
    i16x8_avgr_u = 155,
    i16x8_extmul_low_i8x16_s = 156,
    i16x8_extmul_high_i8x16_s = 157,
    i16x8_extmul_low_i8x16_u = 158,
    i16x8_extmul_high_i8x16_u = 160,

    i32x4_extadd_pairwise_i16x8_s = 126,
    i32x4_extadd_pairwise_i16x8_u = 127,
    i32x4_abs = 160,
    i32x4_neg = 161,
    i32x4_all_true = 163,
    i32x4_bitmask = 164,
    i32x4_extend_low_i16x8_s = 167,
    i32x4_extend_high_i16x8_s = 168,
    i32x4_extend_low_i16x8_u = 169,
    i32x4_extend_high_i16x8_u = 170,
    i32x4_shl = 171,
    i32x4_shr_s = 172,
    i32x4_shr_u = 173,
    i32x4_add = 174,
    i32x4_sub = 177,
    i32x4_mul = 181,
    i32x4_min_s = 182,
    i32x4_min_u = 183,
    i32x4_max_s = 184,
    i32x4_max_u = 185,
    i32x4_dot_i16x8_s = 186,
    i32x4_extmul_low_i16x8_s = 188,
    i32x4_extmul_high_i16x8_s = 189,
    i32x4_extmul_low_i16x8_u = 190,
    i32x4_extmul_high_i16x8_u = 191,

    i64x2_abs = 192,
    i64x2_neg = 193,
    i64x2_all_true = 195,
    i64x2_bitmask = 196,
    i64x2_extend_low_i32x4_s = 199,
    i64x2_extend_high_i32x4_s = 200,
    i64x2_extend_low_i32x4_u = 201,
    i64x2_extend_high_i32x4_u = 202,
    i64x2_shl = 203,
    i64x2_shr_s = 204,
    i64x2_shr_u = 205,
    i64x2_add = 206,
    i64x2_sub = 209,
    i64x2_mul = 213,
    i64x2_extmul_low_i32x4_s = 220,
    i64x2_extmul_high_i32x4_s = 221,
    i64x2_extmul_low_i32x4_u = 222,
    i64x2_extmul_high_i32x4_u = 223,

    f32x4_ceil = 103,
    f32x4_floor = 104,
    f32x4_trunc = 105,
    f32x4_nearest = 106,
    f32x4_abs = 224,
    f32x4_neg = 225,
    f32x4_sqrt = 227,
    f32x4_add = 228,
    f32x4_sub = 229,
    f32x4_mul = 230,
    f32x4_div = 231,
    f32x4_min = 232,
    f32x4_max = 233,
    f32x4_pmin = 234,
    f32x4_pmax = 235,

    f64x2_ceil = 116,
    f64x2_floor = 117,
    f64x2_trunc = 122,
    f64x2_nearest = 148,
    f64x2_abs = 236,
    f64x2_neg = 237,
    f64x2_sqrt = 239,
    f64x2_add = 240,
    f64x2_sub = 241,
    f64x2_mul = 242,
    f64x2_div = 243,
    f64x2_min = 244,
    f64x2_max = 245,
    f64x2_pmin = 246,
    f64x2_pmax = 247,

    i32x4_trunc_sat_f32x4_s = 248,
    i32x4_trunc_sat_f32x4_u = 249,
    f32x4_convert_i32x4_s = 250,
    f32x4_convert_i32x4_u = 251,
    i32x4_trunc_sat_f64x2_s_zero = 252,
    i32x4_trunc_sat_f64x2_u_zero = 253,
    f64x2_convert_low_i32x4_s = 254,
    f64x2_convert_low_i32x4_u = 255,
    f32x4_demote_f64x2_zero = 94,
    f64x2_promote_low_f32x4 = 95
}