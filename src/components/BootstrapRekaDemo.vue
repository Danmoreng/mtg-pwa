<script setup lang="ts">
import { ref } from 'vue'
import { 
  DropdownMenuRoot, 
  DropdownMenuTrigger, 
  DropdownMenuPortal, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DialogRoot,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose
} from 'reka-ui'

const isDialogOpen = ref(false)
</script>

<template>
  <div class="p-4">
    <h2 class="mb-4">Bootstrap + Reka UI Demo</h2>
    
    <!-- Dropdown Example -->
    <div class="mb-4">
      <h3 class="mb-2">Dropdown Menu</h3>
      <DropdownMenuRoot>
        <DropdownMenuTrigger as-child>
          <button type="button" class="btn btn-glass-primary">
            Actions
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
          <DropdownMenuContent class="dropdown-menu show p-1">
            <DropdownMenuItem class="dropdown-item">Edit</DropdownMenuItem>
            <DropdownMenuItem class="dropdown-item">Duplicate</DropdownMenuItem>
            <DropdownMenuItem class="dropdown-item text-danger">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
    </div>
    
    <!-- Dialog Example -->
    <div>
      <h3 class="mb-2">Modal Dialog</h3>
      <DialogRoot v-model:open="isDialogOpen">
        <DialogTrigger as-child>
          <button class="btn btn-glass-primary">Open dialog</button>
        </DialogTrigger>

        <DialogPortal>
          <DialogOverlay class="modal-backdrop fade show"></DialogOverlay>

          <DialogContent class="modal d-block" role="dialog">
            <div class="modal-dialog modal-dialog-centered">
              <div class="modal-content">
                <div class="modal-header">
                  <DialogTitle class="modal-title">Confirm</DialogTitle>
                  <DialogClose as-child>
                    <button class="btn-close" aria-label="Close"></button>
                  </DialogClose>
                </div>
                <div class="modal-body">
                  Use Bootstrap structure and spacing utilities here.
                </div>
                <div class="modal-footer">
                  <DialogClose as-child><button class="btn btn-secondary">Cancel</button></DialogClose>
                  <button class="btn btn-glass-primary" @click="isDialogOpen = false">Continue</button>
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </DialogRoot>
    </div>
  </div>
</template>

<style scoped>
/* Optional: tweak Bootstrap menu sizing in your component */
.dropdown-menu { min-width: 12rem; }
</style>