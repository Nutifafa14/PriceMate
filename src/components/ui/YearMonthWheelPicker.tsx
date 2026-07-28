import React, { useEffect, useRef } from "react";
import { NativeSyntheticEvent, NativeScrollEvent, Pressable, ScrollView, View } from "react-native";

import { useTheme } from "@/theme";

import { ThemedText } from "./ThemedText";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;
const CENTER_OFFSET = Math.floor(VISIBLE_ROWS / 2) * ITEM_HEIGHT;

export type YearMonthValue = { year: number; month: number };

export type YearMonthWheelPickerProps = {
  value: YearMonthValue;
  minYear: number;
  /** For `minYear` only, months before this are invalid (e.g. the current month, so the picker can't select the past). Ignored for any later year. */
  minMonthForMinYear: number;
  maxYear: number;
  onChange: (value: YearMonthValue) => void;
};

/**
 * A two-wheel year/month picker with native-feel snap scrolling — built on
 * plain ScrollView + snapToInterval, no extra dependency, matching this
 * project's "no unnecessary dependencies" convention. Replaces manual year
 * typing with the same scroll-and-snap interaction as iOS/Android's native
 * date wheels.
 */
export function YearMonthWheelPicker({ value, minYear, minMonthForMinYear, maxYear, onChange }: YearMonthWheelPickerProps) {
  const theme = useTheme();
  const years = React.useMemo(() => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i), [minYear, maxYear]);
  const validMonths = value.year === minYear ? minMonthForMinYear : 1;
  const months = React.useMemo(
    () => Array.from({ length: 12 - validMonths + 1 }, (_, i) => validMonths + i),
    [validMonths],
  );

  function handleYearChange(year: number) {
    const lowestValidMonth = year === minYear ? minMonthForMinYear : 1;
    const month = Math.max(value.month, lowestValidMonth);
    onChange({ year, month });
  }

  function handleMonthChange(month: number) {
    onChange({ year: value.year, month });
  }

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        gap: theme.spacing.md,
        height: ITEM_HEIGHT * VISIBLE_ROWS,
      }}
    >
      <WheelColumn
        items={years}
        selected={value.year}
        renderLabel={(y) => String(y)}
        onSelect={handleYearChange}
        accessibilityLabel="Year"
        minWidth={90}
      />
      <WheelColumn
        items={months}
        selected={value.month}
        renderLabel={(m) => MONTH_NAMES[m - 1]}
        onSelect={handleMonthChange}
        accessibilityLabel="Month"
        minWidth={140}
      />
    </View>
  );
}

function WheelColumn<T extends number>({
  items,
  selected,
  renderLabel,
  onSelect,
  accessibilityLabel,
  minWidth,
}: {
  items: T[];
  selected: T;
  renderLabel: (item: T) => string;
  onSelect: (item: T) => void;
  accessibilityLabel: string;
  minWidth: number;
}) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const lastCommittedIndex = useRef<number>(items.indexOf(selected));

  useEffect(() => {
    const index = Math.max(0, items.indexOf(selected));
    if (index !== lastCommittedIndex.current) {
      lastCommittedIndex.current = index;
      scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    }
  }, [selected, items]);

  function commitFromOffset(offsetY: number) {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(offsetY / ITEM_HEIGHT)));
    lastCommittedIndex.current = index;
    if (items[index] !== selected) onSelect(items[index]);
  }

  function handleMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    commitFromOffset(e.nativeEvent.contentOffset.y);
  }

  return (
    <View style={{ width: minWidth, height: ITEM_HEIGHT * VISIBLE_ROWS }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: CENTER_OFFSET,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.accentMuted,
        }}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: CENTER_OFFSET }}
        onMomentumScrollEnd={handleMomentumEnd}
        accessibilityLabel={accessibilityLabel}
        contentOffset={{ x: 0, y: Math.max(0, items.indexOf(selected)) * ITEM_HEIGHT }}
      >
        {items.map((item) => {
          const isSelected = item === selected;
          return (
            <Pressable
              key={item}
              onPress={() => {
                const index = items.indexOf(item);
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                lastCommittedIndex.current = index;
                onSelect(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${renderLabel(item)}${isSelected ? ", selected" : ""}`}
              style={{ height: ITEM_HEIGHT, alignItems: "center", justifyContent: "center" }}
            >
              <ThemedText variant="subtitle" weight={isSelected ? "bold" : "regular"} color={isSelected ? "accent" : "muted"}>
                {renderLabel(item)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
