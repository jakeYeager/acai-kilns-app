<template>
  <div class="space-y-2">
    <p class="text-sm font-medium text-gray-700">{{ labelText }}</p>

    <!-- Selected chips -->
    <div v-if="modelValue.length" class="flex flex-wrap gap-2">
      <span
        v-for="m in modelValue"
        :key="m.member_id"
        class="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-900"
      >
        {{ m.display_name }}
        <button
          type="button"
          class="text-orange-600 hover:text-orange-900"
          aria-label="remove"
          @click="remove(m.member_id)"
        >
          ×
        </button>
      </span>
    </div>

    <!-- Pickable members -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="m in available"
        :key="m.id"
        type="button"
        class="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm hover:border-gray-300"
        @click="add(m)"
      >
        + {{ m.display_name }}
      </button>
    </div>

    <p v-if="!candidates.length" class="text-sm text-gray-500">
      No trained {{ roleLabel }}s available. Ask an admin to enable training flags.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { FiringMember } from '~/composables/useFirings'
import type { MemberSummary } from '~/composables/useMembers'

const props = defineProps<{
  modelValue: FiringMember[]
  role: 'loader' | 'unloader' | 'operator'
  label?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: FiringMember[]] }>()

const { electricLoaders, electricUnloaders, gasPropaneOperators } = useMembers()

const candidates = computed<MemberSummary[]>(() => {
  if (props.role === 'loader') return electricLoaders.value
  if (props.role === 'unloader') return electricUnloaders.value
  return gasPropaneOperators.value
})

const roleLabel = computed(() => props.role)
const labelText = computed(
  () => props.label || (props.role === 'loader' ? 'Loaders' : props.role === 'unloader' ? 'Unloaders' : 'Operators')
)

const available = computed(() => {
  const taken = new Set(props.modelValue.map((m) => m.member_id))
  return candidates.value.filter((m) => !taken.has(m.id))
})

function add(member: MemberSummary) {
  emit('update:modelValue', [
    ...props.modelValue,
    { member_id: member.id, display_name: member.display_name },
  ])
}

function remove(memberId: string) {
  emit('update:modelValue', props.modelValue.filter((m) => m.member_id !== memberId))
}
</script>
