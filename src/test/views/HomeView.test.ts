import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import HomeView from '../../features/dashboard/HomeView.vue';

describe('HomeView', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should render', () => {
    const wrapper = mount(HomeView, {
        global: {
            plugins: [
            createTestingPinia({
                createSpy: vi.fn,
            }),
            ],
        },
    });
    expect(wrapper.exists()).toBe(true);
  });
});